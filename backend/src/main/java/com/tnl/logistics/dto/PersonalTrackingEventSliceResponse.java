package com.tnl.logistics.dto;

import org.springframework.data.domain.Slice;

import java.util.List;

public record PersonalTrackingEventSliceResponse(
        List<PersonalTrackingEventResponse> content, PageMetadata page) {

    public static PersonalTrackingEventSliceResponse from(Slice<PersonalTrackingEventResponse> events) {
        return new PersonalTrackingEventSliceResponse(events.getContent(),
                new PageMetadata(events.getNumber(), events.getSize(), events.hasNext()));
    }

    public record PageMetadata(int number, int size, boolean hasNext) { }
}
