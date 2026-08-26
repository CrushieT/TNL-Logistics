package com.tnl.logistics.dto;

import java.time.LocalDateTime;

public class TrackingEventResponse {

    private String event;
    private String date;
    private String time;
    private String by;
    private String remarks;
    private Boolean done;
    private LocalDateTime timestamp;

    public TrackingEventResponse() {}

    public TrackingEventResponse(String event, String date, String time, String by, String remarks, Boolean done, LocalDateTime timestamp) {
        this.event = event;
        this.date = date;
        this.time = time;
        this.by = by;
        this.remarks = remarks;
        this.done = done;
        this.timestamp = timestamp;
    }

    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public String getTime() { return time; }
    public void setTime(String time) { this.time = time; }

    public String getBy() { return by; }
    public void setBy(String by) { this.by = by; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public Boolean getDone() { return done; }
    public void setDone(Boolean done) { this.done = done; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}
