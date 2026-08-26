package com.tnl.logistics.dto;

public class PrintInfoDto {

    private String status;
    private String date;
    private String by;
    private String printer;
    private Integer count;

    public PrintInfoDto() {}

    public PrintInfoDto(String status, String date, String by, String printer, Integer count) {
        this.status = status;
        this.date = date;
        this.by = by;
        this.printer = printer;
        this.count = count;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public String getBy() { return by; }
    public void setBy(String by) { this.by = by; }

    public String getPrinter() { return printer; }
    public void setPrinter(String printer) { this.printer = printer; }

    public Integer getCount() { return count; }
    public void setCount(Integer count) { this.count = count; }
}
