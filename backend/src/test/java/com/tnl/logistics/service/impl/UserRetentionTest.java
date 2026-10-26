package com.tnl.logistics.service.impl;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.service.IdentifierCounterService;
import com.tnl.logistics.service.SseService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserRetentionTest {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final SseService events = mock(SseService.class);
    private final EntityManager entityManager = mock(EntityManager.class);
    private final UserServiceImpl service = new UserServiceImpl(users, mock(BCryptPasswordEncoder.class),
            mock(IdentifierCounterService.class), events);

    UserRetentionTest() {
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
    }

    @Test
    void referencedStaffIsDeactivatedAndItsSessionsAreRevoked() {
        AppUser actor = staff(UserRole.DISPATCH_STAFF);
        int previousVersion = actor.getTokenVersion();
        when(users.countAuditReferencePresence(actor.getUserId())).thenReturn(1L);
        service.deleteUser(actor.getUserId(), "ADMIN");
        assertFalse(actor.getActive());
        assertEquals(previousVersion + 1, actor.getTokenVersion());
        verify(users).save(actor);
        verify(users, never()).delete(any());
        verify(events).closeStreamsForUser(actor.getUserId());
    }

    @Test
    void unreferencedStaffIsHardDeleted() {
        AppUser actor = staff(UserRole.DISPATCH_STAFF);
        service.deleteUser(actor.getUserId(), "ADMIN");
        verify(users).delete(actor);
        verify(users, never()).save(any());
        verify(events).closeStreamsForUser(actor.getUserId());
    }

    @Test
    void administratorAndSelfDeletionRemainForbidden() {
        AppUser admin = staff(UserRole.ADMIN);
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.deleteUser(admin.getUserId(), "OTHER-ADMIN")).getStatusCode().value());
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> service.deleteUser(admin.getUserId(), admin.getUserId())).getStatusCode().value());
        verify(users, never()).countAuditReferencePresence(any());
        verify(users, never()).delete(any());
    }

    private AppUser staff(UserRole role) {
        AppUser actor = new AppUser("STAFF", "staff", "unused-hash", "Staff", role);
        when(users.findByIdForUpdate(actor.getUserId())).thenReturn(Optional.of(actor));
        return actor;
    }
}
