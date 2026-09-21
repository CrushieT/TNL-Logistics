package com.tnl.logistics.dto;

import java.time.LocalDate;

public class PersonalScanMetricsResponse {

    private LocalDate date;
    private long totalScans;
    private long loadedOnTruck;
    private long arrivedAtTnl;
    private long handedToHauler;

    public PersonalScanMetricsResponse() {}

    public PersonalScanMetricsResponse(LocalDate date, long totalScans, long loadedOnTruck,
                                       long arrivedAtTnl, long handedToHauler) {
        this.date = date;
        this.totalScans = totalScans;
        this.loadedOnTruck = loadedOnTruck;
        this.arrivedAtTnl = arrivedAtTnl;
        this.handedToHauler = handedToHauler;
    }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public long getTotalScans() { return totalScans; }
    public void setTotalScans(long totalScans) { this.totalScans = totalScans; }

    public long getLoadedOnTruck() { return loadedOnTruck; }
    public void setLoadedOnTruck(long loadedOnTruck) { this.loadedOnTruck = loadedOnTruck; }

    public long getArrivedAtTnl() { return arrivedAtTnl; }
    public void setArrivedAtTnl(long arrivedAtTnl) { this.arrivedAtTnl = arrivedAtTnl; }

    public long getHandedToHauler() { return handedToHauler; }
    public void setHandedToHauler(long handedToHauler) { this.handedToHauler = handedToHauler; }
}
