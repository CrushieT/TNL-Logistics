package com.tnl.logistics.service.impl;

import com.tnl.logistics.model.OfflineScanReceipt;
import com.tnl.logistics.repository.OfflineScanReceiptRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class OfflineReceiptCleanupService {
    private final OfflineScanReceiptRepository receiptRepository;
    public OfflineReceiptCleanupService(OfflineScanReceiptRepository receiptRepository) { this.receiptRepository = receiptRepository; }

    @Scheduled(cron = "0 30 2 * * *", zone = "UTC")
    public void deleteExpiredReceipts() { for (int batch = 0; batch < 10; batch++) if (!deleteBatch()) return; }

    @Transactional
    boolean deleteBatch() {
        List<OfflineScanReceipt> receipts = receiptRepository.findTop1000ByProcessedAtBeforeOrderByProcessedAtAsc(
                LocalDateTime.now(ZoneOffset.UTC).minusDays(90));
        if (receipts.isEmpty()) return false;
        receiptRepository.deleteAll(receipts);
        return receipts.size() == 1000;
    }
}
