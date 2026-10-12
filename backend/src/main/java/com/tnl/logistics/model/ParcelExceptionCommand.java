package com.tnl.logistics.model;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "parcel_exception_command")
public class ParcelExceptionCommand implements Persistable<String> {
    @Id @Column(name = "request_id", length = 64) private String requestId;
    @Column(nullable = false, updatable = false, length = 20) private String action;
    @Column(name = "target_id", length = 30, nullable = false, updatable = false) private String targetId;
    @Column(name = "actor_id", length = 20, nullable = false, updatable = false) private String actorId;
    @Column(nullable = false, updatable = false) private String reason;
    @Column(name = "expected_revision", nullable = false, updatable = false) private long expectedRevision;
    @Transient private boolean isNew = true;
    protected ParcelExceptionCommand() {}
    public ParcelExceptionCommand(String requestId, String action, String targetId, String actorId, String reason, long revision) {
        this.requestId = requestId;
        this.action = action;
        this.targetId = targetId;
        this.actorId = actorId;
        this.reason = reason;
        this.expectedRevision = revision;
    }
    @Override public String getId() { return requestId; }
    @Override public boolean isNew() { return isNew; }
    @PostLoad @PostPersist void markPersisted() { isNew = false; }
    public boolean matches(ParcelExceptionCommand command) {
        return action.equals(command.action) && targetId.equals(command.targetId)
                && actorId.equals(command.actorId) && reason.equals(command.reason)
                && expectedRevision == command.expectedRevision;
    }
}
