package com.tnl.logistics.dto;

public class MobileLoginRequest extends LoginRequest {
    private boolean confirmDeviceSwitch;

    public boolean isConfirmDeviceSwitch() { return confirmDeviceSwitch; }

    public void setConfirmDeviceSwitch(boolean confirmDeviceSwitch) {
        this.confirmDeviceSwitch = confirmDeviceSwitch;
    }
}
