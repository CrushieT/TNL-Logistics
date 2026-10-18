package com.tnl.logistics.controller;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import com.tnl.logistics.service.SseService;
import com.tnl.logistics.support.TestSessionTokenFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Decisive regression test verifying that under spring.jpa.open-in-view=false:
 * 1. Ordinary non-SSE requests release connections immediately.
 * 2. 5 concurrent SSE streams retain 0 borrowed connections in HikariCP.
 * 3. Rapid repeated disconnect/reconnect cycles (simulating browser Ctrl+Shift+R reloads)
 *    do not accumulate borrowed connections or starve the pool.
 * 4. Server-side stream cleanup across heartbeat intervals prunes disconnected streams
 *    and restores active stream count to 0.
 * 5. Ordinary requests remain available with low latency throughout all stream lifecycles.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.datasource.hikari.maximum-pool-size=5",
                "spring.datasource.hikari.minimum-idle=1",
                "spring.datasource.hikari.connection-timeout=3000",
                "spring.datasource.hikari.register-mbeans=true"
        }
)
@ActiveProfiles("test")
public class SseConnectionLeakIntegrationTest {

    private static final Logger log = LoggerFactory.getLogger(SseConnectionLeakIntegrationTest.class);

    @LocalServerPort
    private int port;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private TestSessionTokenFactory sessionTokens;

    @Autowired
    private com.tnl.logistics.service.impl.SseServiceImpl sseService;

    @BeforeEach
    public void setup() {
        sseService.closeStreamsForUser("USR-ADMIN");
        assertEquals(0, sseService.getActiveClientCount(), "Active SSE stream count must be 0 before test run");
    }

    private static class ManagedStream implements AutoCloseable {
        final int id;
        final Socket socket;
        final InputStream stream;
        final Thread readerThread;
        final CountDownLatch initLatch = new CountDownLatch(1);
        final AtomicBoolean closed = new AtomicBoolean(false);

        ManagedStream(int id, Socket socket, InputStream stream, Thread readerThread) {
            this.id = id;
            this.socket = socket;
            this.stream = stream;
            this.readerThread = readerThread;
        }

        @Override
        public void close() {
            if (closed.compareAndSet(false, true)) {
                try {
                    socket.setSoLinger(true, 0); // Send TCP RST to simulate browser hard abort
                    socket.close();
                } catch (Exception ignored) {}
                try {
                    stream.close();
                } catch (Exception ignored) {}
                readerThread.interrupt();
                try {
                    readerThread.join(1000);
                } catch (InterruptedException ignored) {}
            }
        }
    }

    private HikariPoolMXBean getPoolBean() {
        HikariDataSource hikari = (HikariDataSource) dataSource;
        return hikari.getHikariPoolMXBean();
    }

    /**
     * Separate diagnostic database connection so evidence collection never depends on
     * or borrows from the application's Hikari pool under test.
     */
    private void queryProcesslistViaDiagnosticConnection(String phase) {
        HikariDataSource hikari = (HikariDataSource) dataSource;
        HikariPoolMXBean pool = getPoolBean();
        log.info("=== [{}] POOL: active={}, idle={}, awaiting={}, total={} | STREAMS: {} ===",
                phase, pool.getActiveConnections(), pool.getIdleConnections(),
                pool.getThreadsAwaitingConnection(), pool.getTotalConnections(),
                sseService.getActiveClientCount());

        try (Connection diagConn = DriverManager.getConnection(hikari.getJdbcUrl(), hikari.getUsername(), hikari.getPassword());
             Statement stmt = diagConn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO FROM information_schema.processlist WHERE DB = 'tnl_test'")) {
            while (rs.next()) {
                log.info("   [Diag] MySQL Process: id={}, user={}, command={}, time={}, state={}, info={}",
                        rs.getLong("ID"), rs.getString("USER"), rs.getString("COMMAND"),
                        rs.getInt("TIME"), rs.getString("STATE"), rs.getString("INFO"));
            }
        } catch (Exception e) {
            log.error("Failed to query diagnostic processlist: {}", e.getMessage());
        }
    }

    private ManagedStream openStream(int streamId, String token) throws Exception {
        Socket socket = new Socket("127.0.0.1", port);
        socket.setSoTimeout(5000);

        OutputStream out = socket.getOutputStream();
        String httpRequest = "GET /api/v1/events/stream HTTP/1.1\r\n" +
                "Host: 127.0.0.1:" + port + "\r\n" +
                "Authorization: " + token + "\r\n" +
                "Accept: text/event-stream\r\n" +
                "Connection: close\r\n\r\n";
        out.write(httpRequest.getBytes(StandardCharsets.UTF_8));
        out.flush();

        InputStream is = socket.getInputStream();
        CountDownLatch initLatch = new CountDownLatch(1);
        Thread reader = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    if (line.contains("CONNECTED") || line.contains("INIT")) {
                        initLatch.countDown();
                    }
                }
            } catch (Exception ignored) {}
        }, "sse-leak-reader-" + streamId);
        reader.setDaemon(true);
        reader.start();

        assertTrue(initLatch.await(5, TimeUnit.SECONDS), "Stream " + streamId + " failed to receive INIT");
        return new ManagedStream(streamId, socket, is, reader);
    }

    private long executeOrdinaryRequest(String token) throws Exception {
        HttpClient testClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/api/v1/auth/first-boot-status"))
                .header("Authorization", token)
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();

        long start = System.currentTimeMillis();
        HttpResponse<String> response = testClient.send(request, HttpResponse.BodyHandlers.ofString());
        long duration = System.currentTimeMillis() - start;

        assertEquals(200, response.statusCode());
        assertTrue(duration < 1000, "Ordinary request duration exceeded 1000 ms threshold; took " + duration + "ms");
        log.info("Ordinary request completed: status={}, duration={}ms", response.statusCode(), duration);
        return duration;
    }

    @Test
    @DisplayName("Measure ordinary non-SSE request pool behavior")
    public void testOrdinaryRequestsDoNotRetainConnections() throws Exception {
        String adminToken = "Bearer " + sessionTokens.generateToken("USR-ADMIN", "ADMIN");
        HikariPoolMXBean pool = getPoolBean();

        queryProcesslistViaDiagnosticConnection("BEFORE_ORDINARY_REQUESTS");

        for (int i = 0; i < 10; i++) {
            long duration = executeOrdinaryRequest(adminToken);
            log.info("Sample {} ordinary request latency: {}ms", i + 1, duration);
        }

        Thread.sleep(100);
        queryProcesslistViaDiagnosticConnection("AFTER_ORDINARY_REQUESTS");

        assertEquals(0, pool.getActiveConnections(), "Active connections must be 0 after ordinary requests finish");
        assertEquals(0, pool.getThreadsAwaitingConnection(), "No pending connection borrowers");
    }

    @Test
    @DisplayName("Verify 5 concurrent SSE streams retain 0 borrowed connections under open-in-view=false")
    public void testConcurrentSseStreamsRetainZeroBorrowedConnections() throws Exception {
        String adminToken = "Bearer " + sessionTokens.generateToken("USR-ADMIN", "ADMIN");
        HikariPoolMXBean pool = getPoolBean();
        List<ManagedStream> streams = new ArrayList<>();

        try {
            queryProcesslistViaDiagnosticConnection("BEFORE_CONCURRENT_STREAMS");
            assertEquals(0, pool.getActiveConnections());

            for (int i = 1; i <= 5; i++) {
                ManagedStream ms = openStream(i, adminToken);
                streams.add(ms);
                Thread.sleep(100);
                queryProcesslistViaDiagnosticConnection("STREAM_" + i + "_OPENED");

                // Decisive invariant: open-in-view=false ensures borrowed connection count remains 0
                assertEquals(0, pool.getActiveConnections(),
                        "Borrowed connections must be 0 with " + i + " active SSE streams");
                assertEquals(0, pool.getThreadsAwaitingConnection(), "No pending connection borrowers");
            }

            assertEquals(5, sseService.getActiveClientCount(), "Active client count must reflect 5 connected streams");

            // Ordinary request while all 5 streams are active
            long duration = executeOrdinaryRequest(adminToken);
            log.info("Ordinary request while 5 streams active completed in {}ms", duration);

            assertEquals(0, pool.getActiveConnections(), "Borrowed connections remain 0 after ordinary request");

        } finally {
            for (ManagedStream ms : streams) {
                ms.close();
            }
            // Trigger bounded heartbeat intervals to prune closed streams
            for (int interval = 1; interval <= 5 && sseService.getActiveClientCount() > 0; interval++) {
                sseService.sendHeartbeat();
                Thread.sleep(100);
            }
            queryProcesslistViaDiagnosticConnection("AFTER_CONCURRENT_STREAMS_CLOSED");
            assertEquals(0, sseService.getActiveClientCount(), "All streams must be pruned after close and heartbeat");
        }
    }

    @Test
    @DisplayName("Verify repeated disconnect/reconnect cycles simulating rapid hard reloads with bounded heartbeat cleanup")
    public void testRapidHardReloadsAndHeartbeatPruning() throws Exception {
        String adminToken = "Bearer " + sessionTokens.generateToken("USR-ADMIN", "ADMIN");
        HikariPoolMXBean pool = getPoolBean();
        List<ManagedStream> streams = new ArrayList<>();

        try {
            queryProcesslistViaDiagnosticConnection("BEFORE_RELOAD_CYCLES");
            assertEquals(0, pool.getActiveConnections());

            // Simulate 10 rapid disconnect/reconnect cycles (browser Ctrl+Shift+R reloads)
            for (int cycle = 1; cycle <= 10; cycle++) {
                ManagedStream stream = openStream(cycle, adminToken);
                streams.add(stream);

                // Simulate hard reload: client closes stream immediately
                stream.close();

                // Assert zero connections retained after each cycle
                assertEquals(0, pool.getActiveConnections(),
                        "Active borrowed connections must remain 0 after reload cycle " + cycle);
                assertEquals(0, pool.getThreadsAwaitingConnection(), "No pending borrowers");
            }

            log.info("Completed 10 rapid reload cycles. Registered server stream count before heartbeat: {}",
                    sseService.getActiveClientCount());

            // Server-side cleanup: invoke sendHeartbeat across bounded intervals to write to closed sockets and prune dead emitters
            for (int interval = 1; interval <= 5 && sseService.getActiveClientCount() > 0; interval++) {
                sseService.sendHeartbeat();
                Thread.sleep(100);
            }

            queryProcesslistViaDiagnosticConnection("AFTER_HEARTBEAT_PRUNING");

            // Assert bounded cleanup: all disconnected clients pruned
            assertEquals(0, sseService.getActiveClientCount(),
                    "Server stream count must return to 0 after heartbeat prunes dead clients");
            assertEquals(0, pool.getActiveConnections(), "Borrowed connections must be 0");
            assertEquals(0, pool.getThreadsAwaitingConnection(), "No threads awaiting connection");

            // Verify ordinary requests remain immediately responsive
            long duration = executeOrdinaryRequest(adminToken);
            log.info("Ordinary request post-reload-pruning latency: {}ms", duration);

        } finally {
            for (ManagedStream ms : streams) {
                ms.close();
            }
        }
    }
}
