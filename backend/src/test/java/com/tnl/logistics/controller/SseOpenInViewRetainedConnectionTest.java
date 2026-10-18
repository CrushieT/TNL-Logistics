package com.tnl.logistics.controller;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import com.tnl.logistics.support.TestSessionTokenFactory;
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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Isolated regression demonstrating the connection leak and pool exhaustion
 * that occurs under the baseline configuration of spring.jpa.open-in-view=true.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.datasource.hikari.maximum-pool-size=5",
                "spring.datasource.hikari.minimum-idle=1",
                "spring.datasource.hikari.connection-timeout=3000",
                "spring.datasource.hikari.register-mbeans=true",
                "spring.jpa.open-in-view=true"
        }
)
@ActiveProfiles("test")
public class SseOpenInViewRetainedConnectionTest {

    private static final Logger log = LoggerFactory.getLogger(SseOpenInViewRetainedConnectionTest.class);

    @LocalServerPort
    private int port;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private TestSessionTokenFactory sessionTokens;

    private static class ManagedStream implements AutoCloseable {
        final int id;
        final HttpClient client;
        final InputStream stream;
        final Thread readerThread;
        final CountDownLatch initLatch = new CountDownLatch(1);
        final AtomicBoolean closed = new AtomicBoolean(false);

        ManagedStream(int id, HttpClient client, InputStream stream, Thread readerThread) {
            this.id = id;
            this.client = client;
            this.stream = stream;
            this.readerThread = readerThread;
        }

        @Override
        public void close() {
            if (closed.compareAndSet(false, true)) {
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
     * Diagnostic query using an independent direct JDBC connection so pool exhaustion
     * cannot block or prevent evidence collection.
     */
    private void queryProcesslistViaDiagnosticConnection(String phase) {
        HikariDataSource hikari = (HikariDataSource) dataSource;
        HikariPoolMXBean pool = getPoolBean();
        log.info("=== [{}] POOL STATE: active={}, idle={}, awaiting={}, total={} ===",
                phase, pool.getActiveConnections(), pool.getIdleConnections(),
                pool.getThreadsAwaitingConnection(), pool.getTotalConnections());

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

    @Test
    @DisplayName("Demonstrate that open-in-view=true causes 5 SSE streams to exhaust 5-connection pool")
    public void testOpenInViewCausesConnectionRetentionAndPoolExhaustion() throws Exception {
        String adminToken = "Bearer " + sessionTokens.generateToken("USR-ADMIN", "ADMIN");
        HikariPoolMXBean pool = getPoolBean();
        List<ManagedStream> managedStreams = new ArrayList<>();

        try {
            queryProcesslistViaDiagnosticConnection("INITIAL_STATE");
            assertEquals(0, pool.getActiveConnections(), "Baseline active connections should be 0");

            // Open 5 concurrent SSE streams
            for (int i = 1; i <= 5; i++) {
                final int streamId = i;
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5))
                        .build();

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + "/api/v1/events/stream"))
                        .header("Authorization", adminToken)
                        .header("Accept", "text/event-stream")
                        .timeout(Duration.ofSeconds(5))
                        .GET()
                        .build();

                CompletableFuture<HttpResponse<InputStream>> future = client.sendAsync(
                        request, HttpResponse.BodyHandlers.ofInputStream());

                HttpResponse<InputStream> response = future.get(5, TimeUnit.SECONDS);
                assertEquals(200, response.statusCode());
                InputStream is = response.body();

                CountDownLatch initLatch = new CountDownLatch(1);
                Thread reader = new Thread(() -> {
                    try (BufferedReader br = new BufferedReader(new InputStreamReader(is))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            if (line.contains("CONNECTED") || line.contains("INIT")) {
                                initLatch.countDown();
                            }
                        }
                    } catch (Exception ignored) {}
                }, "sse-oiv-reader-" + streamId);
                reader.setDaemon(true);
                reader.start();

                assertTrue(initLatch.await(5, TimeUnit.SECONDS), "Stream " + streamId + " failed to receive INIT");

                ManagedStream handle = new ManagedStream(streamId, client, is, reader);
                managedStreams.add(handle);

                Thread.sleep(100);
                queryProcesslistViaDiagnosticConnection("AFTER_OPEN_STREAM_" + streamId);
                assertEquals(streamId, pool.getActiveConnections(),
                        "Under open-in-view=true, each open stream retains 1 active connection");
            }

            // All 5 connections borrowed
            assertEquals(5, pool.getActiveConnections(), "All 5 pool connections must be borrowed under OSIV");
            assertEquals(0, pool.getIdleConnections(), "0 idle connections remaining");

            // Ordinary request while pool is exhausted
            HttpClient testClient = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();

            HttpRequest ordinaryReq = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/api/v1/auth/first-boot-status"))
                    .header("Authorization", adminToken)
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();

            long start = System.currentTimeMillis();
            HttpResponse<String> ordinaryResp = testClient.send(ordinaryReq, HttpResponse.BodyHandlers.ofString());
            long duration = System.currentTimeMillis() - start;

            log.info("Ordinary request response during exhaustion: status={}, duration={}ms",
                    ordinaryResp.statusCode(), duration);

            // Pool exhaustion causes 500 Internal Server Error (connection acquisition timeout)
            assertEquals(500, ordinaryResp.statusCode(), "Ordinary request must fail with 500 during pool starvation");
            assertTrue(duration >= 2500, "Ordinary request must block for connection-timeout duration");

        } finally {
            log.info("Cleaning up all test streams...");
            for (ManagedStream ms : managedStreams) {
                ms.close();
            }
            Thread.sleep(200);
            queryProcesslistViaDiagnosticConnection("AFTER_STREAMS_CLOSED");
        }
    }
}
