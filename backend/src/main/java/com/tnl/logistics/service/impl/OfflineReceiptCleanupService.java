package com.tnl.logistics.service.impl;

import com.tnl.logistics.model.OfflineScanReceipt;
import com.tnl.logistics.repository.OfflineScanReceiptRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class OfflineReceiptCleanupService {
    private final OfflineScanReceiptRepository receiptRepository;
    private final TransactionTemplate transactionTemplate;
    public OfflineReceiptCleanupService(OfflineScanReceiptRepository receiptRepository,
                                        PlatformTransactionManager transactionManager) {
        this.receiptRepository = receiptRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(cron = "0 30 2 * * *", zone = "UTC")
    public void deleteExpiredReceipts() {
        for (int batch = 0; batch < 10; batch++) {
            Boolean hasFullBatch = transactionTemplate.execute(status -> deleteBatch());
            if (!Boolean.TRUE.equals(hasFullBatch)) return;
        }
    }

    private boolean deleteBatch() {
        List<OfflineScanReceipt> receipts = receiptRepository.findTop1000ByProcessedAtBeforeOrderByProcessedAtAsc(
                LocalDateTime.now(ZoneOffset.UTC).minusDays(90));
        if (receipts.isEmpty()) return false;
        receiptRepository.deleteAll(receipts);
        return receipts.size() == 1000;
    }
}
