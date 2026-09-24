package com.tnl.logistics.config;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Non-buffering response wrapper that attaches X-Renewed-Token and Cache-Control
 * headers before response commitment exclusively for successful 2xx responses.
 */
public class JwtRenewalResponseWrapper extends HttpServletResponseWrapper {

    private final String renewedToken;
    private boolean headerCommitted = false;
    private boolean isError = false;
    private boolean isRedirect = false;
    private ServletOutputStream wrappedOutputStream;
    private PrintWriter wrappedWriter;

    public JwtRenewalResponseWrapper(HttpServletResponse response, String renewedToken) {
        super(response);
        this.renewedToken = renewedToken;
    }

    @Override
    public void sendError(int sc) throws IOException {
        this.isError = true;
        super.sendError(sc);
    }

    @Override
    public void sendError(int sc, String msg) throws IOException {
        this.isError = true;
        super.sendError(sc, msg);
    }

    @Override
    public void sendRedirect(String location) throws IOException {
        this.isRedirect = true;
        super.sendRedirect(location);
    }

    @Override
    public void flushBuffer() throws IOException {
        commitRenewalHeader();
        super.flushBuffer();
    }

    @Override
    public ServletOutputStream getOutputStream() throws IOException {
        if (wrappedOutputStream == null) {
            ServletOutputStream delegate = super.getOutputStream();
            wrappedOutputStream = new ServletOutputStream() {
                @Override
                public boolean isReady() {
                    return delegate.isReady();
                }

                @Override
                public void setWriteListener(WriteListener writeListener) {
                    delegate.setWriteListener(writeListener);
                }

                @Override
                public void write(int b) throws IOException {
                    commitRenewalHeader();
                    delegate.write(b);
                }

                @Override
                public void write(byte[] b, int off, int len) throws IOException {
                    commitRenewalHeader();
                    delegate.write(b, off, len);
                }

                @Override
                public void flush() throws IOException {
                    commitRenewalHeader();
                    delegate.flush();
                }

                @Override
                public void close() throws IOException {
                    commitRenewalHeader();
                    delegate.close();
                }
            };
        }
        return wrappedOutputStream;
    }

    @Override
    public PrintWriter getWriter() throws IOException {
        if (wrappedWriter == null) {
            PrintWriter delegate = super.getWriter();
            wrappedWriter = new PrintWriter(delegate) {
                @Override
                public void write(int c) {
                    commitRenewalHeader();
                    super.write(c);
                }

                @Override
                public void write(char[] buf, int off, int len) {
                    commitRenewalHeader();
                    super.write(buf, off, len);
                }

                @Override
                public void write(String s, int off, int len) {
                    commitRenewalHeader();
                    super.write(s, off, len);
                }

                @Override
                public void flush() {
                    commitRenewalHeader();
                    super.flush();
                }

                @Override
                public void close() {
                    commitRenewalHeader();
                    super.close();
                }
            };
        }
        return wrappedWriter;
    }

    public void commitRenewalHeader() {
        if (headerCommitted) {
            return;
        }
        headerCommitted = true;
        if (!isError && !isRedirect) {
            int status = getStatus();
            if (status >= 200 && status < 300) {
                setHeader("X-Renewed-Token", renewedToken);
                setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
                setHeader("Pragma", "no-cache");
            }
        }
    }
}
