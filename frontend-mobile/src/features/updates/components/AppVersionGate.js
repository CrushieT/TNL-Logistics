import React from 'react';
import { useAppVersionCheck } from '../hooks/useAppVersionCheck';
import { ForceUpdateModal } from './ForceUpdateModal';

/**
 * Root gate component that monitors mobile version status and mounts the non-dismissible
 * force update modal whenever the active build is outdated.
 */
export function AppVersionGate() {
  const {
    isUpdateRequired,
    localVersion,
    serverVersion,
    apkDownloadUrl,
    isLoading,
    checkVersion,
  } = useAppVersionCheck();

  return (
    <ForceUpdateModal
      visible={isUpdateRequired}
      localVersion={localVersion}
      serverVersion={serverVersion}
      apkDownloadUrl={apkDownloadUrl}
      isLoading={isLoading}
      onRetry={checkVersion}
    />
  );
}
