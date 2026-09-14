package com.tnl.logistics.migration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Command-line runner for offline legacy database conversion.
 * Remains completely idle unless explicitly invoked via property or command-line flag.
 */
@Component
public class LegacyUpgradeRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LegacyUpgradeRunner.class);

    private final LegacyDatabaseUpgradeService upgradeService;
    private final Environment environment;

    @Value("${app.migration.legacy-upgrade:false}")
    private boolean legacyUpgradeProperty;

    @Value("${app.migration.backup-confirmed:false}")
    private boolean backupConfirmedProperty;

    @Value("${app.migration.backup-id:}")
    private String backupIdProperty;

    public LegacyUpgradeRunner(LegacyDatabaseUpgradeService upgradeService, Environment environment) {
        this.upgradeService = upgradeService;
        this.environment = environment;
    }

    @Override
    public void run(String... args) {
        boolean isExplicitCommand = legacyUpgradeProperty || containsArg(args, "--legacy-upgrade") || containsArg(args, "--app.migration.legacy-upgrade=true");
        if (!isExplicitCommand) {
            return;
        }

        log.info("================================================================");
        log.info("  OFFLINE LEGACY DATABASE UPGRADE UTILITY ACTIVATED");
        log.info("================================================================");

        boolean isBackupConfirmed = backupConfirmedProperty || containsArg(args, "--backup-confirmed=true") || containsArg(args, "--backup-confirmed");
        String backupId = getArgValue(args, "--backup-id");
        if (backupId == null || backupId.isBlank()) {
            backupId = backupIdProperty;
        }

        try {
            var report = upgradeService.executeLegacyUpgrade(isBackupConfirmed, backupId);
            log.info("----------------------------------------------------------------");
            log.info("UPGRADE SUMMARY REPORT:");
            log.info("  Manifest ID: {}", report.getManifestId());
            log.info("  Backup Reference: {}", report.getBackupReference());
            log.info("  Status: SUCCESS");
            log.info("  Archived Reconciliation Counts:");
            report.getReconciliationCounts().forEach((table, count) ->
                    log.info("    - {}: {} rows queued for staff review", table, count));
            log.info("  Message: {}", report.getMessage());
            log.info("================================================================");
        } catch (Exception e) {
            log.error("Legacy upgrade failed: {}", e.getMessage(), e);
            throw e;
        }
    }

    private boolean containsArg(String[] args, String target) {
        if (args == null) return false;
        for (String arg : args) {
            if (arg != null && (arg.equalsIgnoreCase(target) || arg.startsWith(target + "="))) {
                return true;
            }
        }
        return false;
    }

    private String getArgValue(String[] args, String prefix) {
        if (args == null) return null;
        for (String arg : args) {
            if (arg != null && arg.startsWith(prefix + "=")) {
                return arg.substring((prefix + "=").length()).trim();
            }
        }
        return null;
    }
}
