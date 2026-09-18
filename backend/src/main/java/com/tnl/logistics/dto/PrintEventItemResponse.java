package com.tnl.logistics.dto;

public class PrintEventItemResponse {

    private String kind;
    private String staff;
    private String date;
    private String printer;

    public PrintEventItemResponse() {}

    public PrintEventItemResponse(String kind, String staff, String date, String printer) {
        this.kind = kind;
        this.staff = staff;
        this.date = date;
        this.printer = printer;
    }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getStaff() { return staff; }
    public void setStaff(String staff) { this.staff = staff; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public String getPrinter() { return printer; }
    public void setPrinter(String printer) { this.printer = printer; }
}
