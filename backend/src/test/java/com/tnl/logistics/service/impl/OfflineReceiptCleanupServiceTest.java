package com.tnl.logistics.service.impl;

import com.tnl.logistics.model.OfflineScanReceipt;
import com.tnl.logistics.repository.OfflineScanReceiptRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OfflineReceiptCleanupServiceTest {
    @Test
    void stopsAfterAnEmptyTransactionalBatch() {
        OfflineScanReceiptRepository repository = mock(OfflineScanReceiptRepository.class);
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        when(repository.findTop1000ByProcessedAtBeforeOrderByProcessedAtAsc(any())).thenReturn(List.of());

        new OfflineReceiptCleanupService(repository, manager).deleteExpiredReceipts();

        verify(manager, times(1)).getTransaction(any());
        verify(manager, times(1)).commit(any());
    }

    @Test
    void ac13AndTm14LimitCleanupToTenTransactionsOfAtMostOneThousandReceipts() {
        OfflineScanReceiptRepository repository = mock(OfflineScanReceiptRepository.class);
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenAnswer(invocation -> mock(TransactionStatus.class));
        when(repository.findTop1000ByProcessedAtBeforeOrderByProcessedAtAsc(any()))
                .thenReturn(java.util.Collections.nCopies(1_000, new OfflineScanReceipt()));

        new OfflineReceiptCleanupService(repository, manager).deleteExpiredReceipts();

        verify(manager, times(10)).getTransaction(any());
        verify(manager, times(10)).commit(any());
        verify(repository, times(10)).deleteAll(any(Iterable.class));
    }
}
