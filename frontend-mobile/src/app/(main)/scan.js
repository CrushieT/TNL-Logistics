import React, { useReducer, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  PanResponder,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAuth } from '../../features/auth/context/AuthContext';
import { colors, typography, spacing, radius } from '../../theme';
import {
  SCANNER_MODES,
  SCANNER_PHASES,
  MAX_BATCH_SIZE,
  initialScannerState,
  scannerReducer,
  normalizeTrackingId,
  buildSingleScanRequest,
  buildBatchScanRequest,
  canActivateCamera,
  getScannerConnectivity,
  isRoleTransitionAllowed,
  validateBatchCandidate
} from '../../features/scanner/scannerFlow.mjs';
import { canAccessMobileRoute, MOBILE_ROUTES } from '../../features/auth/services/roleAccess.mjs';
import { trackingScanApi } from '../../features/scanner/services/trackingScanApi';
import { safeHaptics } from '../../features/scanner/utils/haptics';
import ScanViewfinder from '../../features/scanner/components/ScanViewfinder';
import SingleScanReview from '../../features/scanner/components/SingleScanReview';
import BatchScanPanel from '../../features/scanner/components/BatchScanPanel';
import ScanResultPanel from '../../features/scanner/components/ScanResultPanel';

const CAMERA_HEIGHTS = [0, 160, 280];
const CAMERA_HEIGHT_LABELS = ['Collapsed', 'Compact', 'Expanded'];
const CAMERA_TAP_THRESHOLD = 8;
const DEFAULT_CAMERA_HEIGHT_INDEX = CAMERA_HEIGHTS.length - 1;

function findNearestCameraHeightIndex(height) {
  return CAMERA_HEIGHTS.reduce((nearestIndex, cameraHeight, index) => (
    Math.abs(cameraHeight - height) < Math.abs(CAMERA_HEIGHTS[nearestIndex] - height)
      ? index
      : nearestIndex
  ), 0);
}

export default function ScanScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, isLoading: authLoading } = useAuth();
  const netInfo = useNetInfo();
  const connectivity = getScannerConnectivity(netInfo.isConnected, netInfo.isInternetReachable);
  const [permission, requestPermission] = useCameraPermissions();

  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [cameraMountKey, setCameraMountKey] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [cameraHeightIndex, setCameraHeightIndex] = useState(DEFAULT_CAMERA_HEIGHT_INDEX);

  // Vehicles state
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  // Synchronous guards to prevent rapid double-tap race conditions
  const scanLockRef = useRef(false);
  const submitLockRef = useRef(false);
  const cooldownTimerRef = useRef(null);
  const cameraHeightIndexRef = useRef(DEFAULT_CAMERA_HEIGHT_INDEX);
  const cameraDragStartHeightRef = useRef(CAMERA_HEIGHTS[DEFAULT_CAMERA_HEIGHT_INDEX]);
  const animatedCameraHeight = useRef(
    new Animated.Value(CAMERA_HEIGHTS[DEFAULT_CAMERA_HEIGHT_INDEX])
  ).current;

  // Navigation protection refs
  const pendingNavigationActionRef = useRef(null);
  const allowLeaveRef = useRef(false);
  const abortControllerRef = useRef(null);

  const animateCameraToIndex = useCallback((nextIndex) => {
    const boundedIndex = Math.max(0, Math.min(CAMERA_HEIGHTS.length - 1, nextIndex));
    cameraHeightIndexRef.current = boundedIndex;
    setCameraHeightIndex(boundedIndex);
    animatedCameraHeight.stopAnimation();
    Animated.spring(animatedCameraHeight, {
      toValue: CAMERA_HEIGHTS[boundedIndex],
      stiffness: 260,
      damping: 28,
      mass: 0.7,
      useNativeDriver: false
    }).start();
  }, [animatedCameraHeight]);

  const resizeCamera = useCallback((indexDelta) => {
    animateCameraToIndex(cameraHeightIndexRef.current + indexDelta);
  }, [animateCameraToIndex]);

  const toggleCameraHeight = useCallback(() => {
    const currentIndex = cameraHeightIndexRef.current;
    if (currentIndex === DEFAULT_CAMERA_HEIGHT_INDEX) {
      animateCameraToIndex(DEFAULT_CAMERA_HEIGHT_INDEX - 1);
    } else if (currentIndex === 0) {
      animateCameraToIndex(1);
    } else {
      animateCameraToIndex(DEFAULT_CAMERA_HEIGHT_INDEX);
    }
  }, [animateCameraToIndex]);

  const cameraDividerPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !isKeyboardVisible,
    onMoveShouldSetPanResponder: (_, gestureState) => (
      !isKeyboardVisible
      && Math.abs(gestureState.dy) >= 8
      && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
    ),
    onPanResponderGrant: () => {
      animatedCameraHeight.stopAnimation((currentHeight) => {
        cameraDragStartHeightRef.current = currentHeight;
      });
    },
    onPanResponderMove: (_, gestureState) => {
      const nextHeight = Math.max(
        CAMERA_HEIGHTS[0],
        Math.min(
          CAMERA_HEIGHTS[DEFAULT_CAMERA_HEIGHT_INDEX],
          cameraDragStartHeightRef.current + gestureState.dy
        )
      );
      animatedCameraHeight.setValue(nextHeight);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (Math.abs(gestureState.dy) < CAMERA_TAP_THRESHOLD) {
        toggleCameraHeight();
      } else {
        const releasedHeight = Math.max(
          CAMERA_HEIGHTS[0],
          Math.min(
            CAMERA_HEIGHTS[DEFAULT_CAMERA_HEIGHT_INDEX],
            cameraDragStartHeightRef.current + gestureState.dy
          )
        );
        animateCameraToIndex(findNearestCameraHeightIndex(releasedHeight));
      }
    },
    onPanResponderTerminate: () => {
      animatedCameraHeight.stopAnimation((currentHeight) => {
        animateCameraToIndex(findNearestCameraHeightIndex(currentHeight));
      });
    }
  }), [animatedCameraHeight, animateCameraToIndex, isKeyboardVisible, toggleCameraHeight]);

  const handleManualInputFocus = useCallback(() => {
    animatedCameraHeight.stopAnimation();
    animatedCameraHeight.setValue(0);
    setIsKeyboardVisible(true);
  }, [animatedCameraHeight]);

  const handleCameraAccessibilityAction = useCallback((event) => {
    if (isKeyboardVisible) return;
    if (event.nativeEvent.actionName === 'increment') {
      resizeCamera(1);
    } else if (event.nativeEvent.actionName === 'decrement') {
      resizeCamera(-1);
    } else if (event.nativeEvent.actionName === 'activate') {
      toggleCameraHeight();
    }
  }, [isKeyboardVisible, resizeCamera, toggleCameraHeight]);

  useEffect(() => {
    if (!authLoading && user && !canAccessMobileRoute(user.role, MOBILE_ROUTES.SCAN)) {
      router.replace('/(main)');
    }
  }, [user, authLoading, router]);

  // Turn off torch, abort pending requests, and pause camera when screen loses focus
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', () => {
        animatedCameraHeight.stopAnimation();
        animatedCameraHeight.setValue(0);
        setIsKeyboardVisible(true);
      });
      const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
        setIsKeyboardVisible(false);
        animateCameraToIndex(cameraHeightIndexRef.current);
      });

      return () => {
        keyboardShowSubscription.remove();
        keyboardHideSubscription.remove();
        animatedCameraHeight.stopAnimation();
        animatedCameraHeight.setValue(CAMERA_HEIGHTS[cameraHeightIndexRef.current]);
        setIsScreenFocused(false);
        setIsKeyboardVisible(false);
        setTorchEnabled(false);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [animatedCameraHeight, animateCameraToIndex])
  );

  // Clear cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Queue-safe navigation listener via beforeRemove
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) {
        return;
      }
      if (state.mode === SCANNER_MODES.BATCH && state.batchQueue.length > 0) {
        event.preventDefault();
        pendingNavigationActionRef.current = event.data.action;
        dispatch({ type: 'REQUEST_LEAVE' });
      }
    });
    return unsubscribe;
  }, [navigation, state.mode, state.batchQueue.length]);

  useEffect(() => {
    const role = user?.role;
    dispatch({ type: 'RECONCILE_ROLE_PERMISSIONS', payload: role });
    if (!isRoleTransitionAllowed(role, 'LOADED_ON_TRUCK')) {
      setVehicles([]);
    }
  }, [user?.role]);

  const loadVehicles = useCallback(async () => {
    if (!connectivity.isOnline) {
      setVehicles([]);
      setLoadingVehicles(false);
      return;
    }
    if (!isRoleTransitionAllowed(user?.role, 'LOADED_ON_TRUCK')) {
      setVehicles([]);
      setLoadingVehicles(false);
      return;
    }
    setLoadingVehicles(true);
    try {
      const data = await trackingScanApi.getActiveVehicles();
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      setVehicles([]);
      dispatch({ type: 'SET_ERROR', payload: 'Unable to load active vehicles. Check your connection and retry.' });
    } finally {
      setLoadingVehicles(false);
    }
  }, [connectivity.isOnline, user?.role]);

  // When switching to BATCH with LOADED_ON_TRUCK, load vehicles
  useEffect(() => {
    if (state.mode === SCANNER_MODES.BATCH
      && state.batchOperation === 'LOADED_ON_TRUCK'
      && isRoleTransitionAllowed(user?.role, state.batchOperation)
      && vehicles.length === 0) {
      loadVehicles();
    }
  }, [state.mode, state.batchOperation, vehicles.length, loadVehicles, user?.role]);

  const handleToggleTorch = () => {
    setTorchEnabled((prev) => !prev);
  };

  const handleScanCandidate = async (rawValue) => {
    if (!rawValue || scanLockRef.current) return;

    if (!connectivity.isOnline) {
      void safeHaptics.warning();
      dispatch({ type: 'SET_ERROR', payload: 'Internet connection required to scan parcels.' });
      return;
    }

    if (state.mode === SCANNER_MODES.SINGLE) {
      if (state.phase !== SCANNER_PHASES.SCANNING && state.phase !== SCANNER_PHASES.RESULT) {
        return;
      }
      scanLockRef.current = true;
      const normalized = normalizeTrackingId(rawValue);

      if (!normalized.isValid) {
        void safeHaptics.error();
        dispatch({ type: 'SET_ERROR', payload: normalized.error });
        scanLockRef.current = false;
        return;
      }

      void safeHaptics.selection();
      dispatch({ type: 'LOOKUP_STARTED', payload: normalized.trackingId });

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const context = await trackingScanApi.getScanContext(normalized.trackingId, controller.signal);
        dispatch({ type: 'SET_CONTEXT', payload: context });
        if (context.requiresVehicle
          && isRoleTransitionAllowed(user?.role, context.nextStatusCode)
          && vehicles.length === 0) {
          loadVehicles();
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        void safeHaptics.error();
        const msg = err.response?.data?.message || err.message || 'Failed to retrieve scan context.';
        dispatch({
          type: 'LOOKUP_FAILED',
          payload: { trackingId: normalized.trackingId, message: msg }
        });
        scanLockRef.current = false;
      }
    } else {
      // BATCH mode
      if (state.phase !== SCANNER_PHASES.BATCH_READY) {
        return;
      }
      if (!state.batchOperation) {
        void safeHaptics.warning();
        dispatch({ type: 'SET_ERROR', payload: 'Please select a target operation before scanning parcels.' });
        return;
      }
      if (!isRoleTransitionAllowed(user?.role, state.batchOperation)) {
        void safeHaptics.warning();
        dispatch({ type: 'RECONCILE_ROLE_PERMISSIONS', payload: user?.role });
        return;
      }
      if (state.batchOperation === 'LOADED_ON_TRUCK' && !state.batchVehicleId) {
        void safeHaptics.warning();
        dispatch({ type: 'SET_ERROR', payload: 'Please select an active vehicle before scanning parcels.' });
        return;
      }

      scanLockRef.current = true;
      const normalized = normalizeTrackingId(rawValue);

      if (!normalized.isValid) {
        void safeHaptics.error();
        dispatch({ type: 'SET_ERROR', payload: normalized.error });
        cooldownTimerRef.current = setTimeout(() => { scanLockRef.current = false; }, 750);
        return;
      }

      if (state.batchQueue.includes(normalized.trackingId)) {
        void safeHaptics.warning();
        dispatch({ type: 'SET_ERROR', payload: `Parcel ${normalized.trackingId} is already in the batch.` });
        cooldownTimerRef.current = setTimeout(() => { scanLockRef.current = false; }, 750);
        return;
      }

      if (state.batchQueue.length >= MAX_BATCH_SIZE) {
        void safeHaptics.error();
        dispatch({ type: 'SET_ERROR', payload: `Batch queue limit reached (${MAX_BATCH_SIZE} parcels).` });
        cooldownTimerRef.current = setTimeout(() => { scanLockRef.current = false; }, 750);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const context = await trackingScanApi.getScanContext(normalized.trackingId, controller.signal);
        const validation = validateBatchCandidate(context, state.batchOperation, user?.role);

        if (!validation.isValid) {
          void safeHaptics.warning();
          dispatch({ type: 'SET_ERROR', payload: validation.error });
          cooldownTimerRef.current = setTimeout(() => { scanLockRef.current = false; }, 750);
          return;
        }

        void safeHaptics.selection();
        dispatch({ type: 'ADD_TO_BATCH', payload: normalized.trackingId });

        // 750ms cooldown before accepting next scan
        cooldownTimerRef.current = setTimeout(() => {
          scanLockRef.current = false;
        }, 750);
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        void safeHaptics.error();
        const msg = err.response?.data?.message || err.message || 'Failed to verify parcel status.';
        dispatch({ type: 'SET_ERROR', payload: msg });
        cooldownTimerRef.current = setTimeout(() => { scanLockRef.current = false; }, 750);
      }
    }
  };

  const handleBarcodeScanned = ({ data }) => {
    if (scanLockRef.current) return;
    handleScanCandidate(data);
  };

  const handleManualSubmit = () => {
    if (scanLockRef.current) return;
    if (!state.manualInput || !state.manualInput.trim()) return;
    handleScanCandidate(state.manualInput.trim());
  };

  const handleSingleConfirm = async () => {
    if (submitLockRef.current) return;
    if (!connectivity.isOnline) {
      void safeHaptics.warning();
      dispatch({ type: 'SUBMISSION_FAILED', payload: 'Internet connection required to update this parcel.' });
      return;
    }
    submitLockRef.current = true;
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    try {
      const payload = buildSingleScanRequest(
        state.currentContext,
        state.selectedVehicleId,
        user?.role
      );
      const res = await trackingScanApi.submitSingleScan(payload);
      void safeHaptics.success();
      dispatch({ type: 'SET_SINGLE_RESULT', payload: res });
    } catch (err) {
      void safeHaptics.error();
      const msg = err.response?.data?.message || err.message || 'Status update failed.';
      dispatch({ type: 'SUBMISSION_FAILED', payload: msg });
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleBatchSubmit = async () => {
    if (submitLockRef.current) return;
    if (!connectivity.isOnline) {
      void safeHaptics.warning();
      dispatch({ type: 'SUBMISSION_FAILED', payload: 'Internet connection required to submit this batch.' });
      return;
    }
    submitLockRef.current = true;
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    try {
      const payload = buildBatchScanRequest(
        state.batchQueue,
        state.batchOperation,
        state.batchVehicleId,
        user?.role
      );
      const responses = await trackingScanApi.submitBatchScan(payload);
      void safeHaptics.success();
      const transitionedCount = responses.filter((r) => r.transitionApplied).length;
      const idempotentCount = responses.filter((r) => !r.transitionApplied).length;
      const assignedVehicle = vehicles.find((v) => v.vehicleId === state.batchVehicleId);

      dispatch({
        type: 'SET_BATCH_RESULT',
        payload: {
          totalRequested: responses.length,
          transitionedCount,
          idempotentCount,
          targetStatus: state.batchOperation,
          vehiclePlateNumber: assignedVehicle ? `${assignedVehicle.plateNumber} (${assignedVehicle.vehicleId})` : null
        }
      });
    } catch (err) {
      void safeHaptics.error();
      const msg = err.response?.data?.message || err.message || 'Batch submission failed.';
      dispatch({ type: 'SUBMISSION_FAILED', payload: msg });
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleHeaderBack = () => {
    navigation.goBack();
  };

  const handleScanNext = () => {
    scanLockRef.current = false;
    dispatch({ type: 'RESET_FOR_NEXT_SCAN' });
  };

  const handleDiscardConfirm = () => {
    const pending = state.pendingAction;
    if (pending?.type === 'LEAVE_ROUTE') {
      allowLeaveRef.current = true;
      dispatch({ type: 'DISCARD_CONFIRMED' });
      if (pendingNavigationActionRef.current) {
        const action = pendingNavigationActionRef.current;
        pendingNavigationActionRef.current = null;
        navigation.dispatch(action);
      } else {
        navigation.goBack();
      }
      return;
    }
    dispatch({ type: 'DISCARD_CONFIRMED' });
  };

  const handleDiscardCancel = () => {
    pendingNavigationActionRef.current = null;
    dispatch({ type: 'DISCARD_CANCELLED' });
  };

  // Compute camera eligibility using pure selector
  const viewfinderHeight = CAMERA_HEIGHTS[cameraHeightIndex] || CAMERA_HEIGHTS[1];
  const cameraActive = !isKeyboardVisible && cameraHeightIndex > 0 && connectivity.isOnline && canActivateCamera({
    permissionGranted: Boolean(permission?.granted),
    isScreenFocused,
    cameraError: state.cameraError,
    phase: state.phase,
    mode: state.mode,
    batchOperation: state.batchOperation,
    batchVehicleId: state.batchVehicleId,
    role: user?.role
  });

  const getModalCopy = () => {
    const pending = state.pendingAction;
    if (pending?.type === 'LEAVE_ROUTE') {
      return `You have ${state.batchQueue.length} parcel(s) queued. Leaving will discard the current batch queue.`;
    }
    if (pending?.type === 'SWITCH_MODE') {
      return `You have ${state.batchQueue.length} parcel(s) queued. Switching modes will discard the current batch queue.`;
    }
    if (pending?.type === 'CHANGE_OPERATION') {
      return `You have ${state.batchQueue.length} parcel(s) queued. Changing the operation will discard the current batch queue.`;
    }
    return `You have ${state.batchQueue.length} parcel(s) queued. Discard the current batch queue?`;
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !canAccessMobileRoute(user.role, MOBILE_ROUTES.SCAN)) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        {/* 1. White Safe-Area Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleHeaderBack} style={styles.backButton} accessibilityLabel="Go back">
            <Icon source="arrow-left" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SCAN QR</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* 2. Dark Camera Region */}
        <ScanViewfinder
          cameraActive={cameraActive}
          torchEnabled={torchEnabled}
          onToggleTorch={handleToggleTorch}
          onBarcodeScanned={handleBarcodeScanned}
          permissionGranted={Boolean(permission?.granted)}
          onRequestPermission={requestPermission}
          cameraError={state.cameraError}
          onCameraMountError={() => {
            setTorchEnabled(false);
            dispatch({ type: 'CAMERA_MOUNT_FAILED' });
          }}
          onRetryCamera={() => {
            setCameraMountKey((k) => k + 1);
            dispatch({ type: 'CAMERA_RETRY_REQUESTED' });
          }}
          cameraMountKey={cameraMountKey}
          instructionText={
            state.mode === SCANNER_MODES.SINGLE
              ? 'Each package has its own QR — scan identifies the exact unit'
              : `Batch Mode: ${state.batchQueue.length} / ${MAX_BATCH_SIZE} items scanned`
          }
          pausedText={
            !connectivity.isOnline
              ? 'Internet connection required to scan parcels'
              : state.mode === SCANNER_MODES.BATCH &&
            state.batchOperation === 'LOADED_ON_TRUCK' &&
            !state.batchVehicleId
              ? 'Please select an active vehicle below to start scanning'
              : 'Camera preview paused'
          }
          viewfinderHeight={viewfinderHeight}
          animatedHeight={animatedCameraHeight}
        />

        <View
          {...cameraDividerPanResponder.panHandlers}
          style={[styles.cameraDivider, isKeyboardVisible && styles.cameraDividerDisabled]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Camera panel height"
          accessibilityHint="Swipe up to reduce the camera, swipe down to enlarge it, or tap to toggle its height"
          accessibilityValue={{
            min: 0,
            max: CAMERA_HEIGHTS.length - 1,
            now: isKeyboardVisible ? 0 : cameraHeightIndex,
            text: isKeyboardVisible ? 'Collapsed while typing' : CAMERA_HEIGHT_LABELS[cameraHeightIndex]
          }}
          accessibilityState={{ disabled: isKeyboardVisible }}
          accessibilityActions={[
            { name: 'increment', label: 'Increase camera height' },
            { name: 'decrement', label: 'Decrease camera height' },
            { name: 'activate', label: 'Toggle camera height' }
          ]}
          onAccessibilityAction={handleCameraAccessibilityAction}
        >
          <View style={styles.cameraDividerHandle} />
        </View>

        {!connectivity.isOnline && (
          <View style={styles.networkBanner}>
            <Icon source="wifi-off" size={18} color={colors.danger} />
            <Text style={styles.networkBannerText}>
              {connectivity.isKnown
                ? 'No internet connection. Scanning and submission are unavailable.'
                : 'Checking internet connection. Scanning and submission are unavailable.'}
            </Text>
          </View>
        )}

        {/* Error Notification Banner (non-lookup errors) */}
        {state.error && !state.failedLookupTrackingId && (
          <View style={styles.errorBanner}>
            <Icon source="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{state.error}</Text>
            <TouchableOpacity onPress={() => dispatch({ type: 'CLEAR_ERROR' })}>
              <Icon source="close" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Light Bottom Operations Panel */}
        <View style={styles.bottomPanel}>
          {/* Mode Switcher */}
          {state.phase !== SCANNER_PHASES.SINGLE_REVIEW &&
            state.phase !== SCANNER_PHASES.SUBMITTING &&
            state.phase !== SCANNER_PHASES.BATCH_SUBMITTING &&
            state.phase !== SCANNER_PHASES.RESULT && (
              <View style={styles.modeSwitcherRow}>
                <TouchableOpacity
                  style={[styles.modeTab, state.mode === SCANNER_MODES.SINGLE && styles.modeTabActive]}
                  onPress={() => dispatch({ type: 'SET_MODE', payload: SCANNER_MODES.SINGLE })}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      state.mode === SCANNER_MODES.SINGLE && styles.modeTabTextActive
                    ]}
                  >
                    SINGLE SCAN
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, state.mode === SCANNER_MODES.BATCH && styles.modeTabActive]}
                  onPress={() => dispatch({ type: 'SET_MODE', payload: SCANNER_MODES.BATCH })}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      state.mode === SCANNER_MODES.BATCH && styles.modeTabTextActive
                    ]}
                  >
                    RAPID BATCH
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          {/* Submitting / Lookup Activity Indicator */}
          {state.phase === SCANNER_PHASES.LOOKUP && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Retrieving parcel details...</Text>
            </View>
          )}

          {/* Inline Lookup Failure Recovery Card */}
          {state.phase === SCANNER_PHASES.SCANNING && state.failedLookupTrackingId && state.error && (
            <View style={styles.lookupRecoveryCard}>
              <View style={styles.lookupRecoveryHeader}>
                <Icon source="alert-circle-outline" size={20} color={colors.danger} />
                <Text style={styles.lookupRecoveryTitle}>Lookup Failed: {state.failedLookupTrackingId}</Text>
              </View>
              <Text style={styles.lookupRecoveryMessage}>{state.error}</Text>
              <View style={styles.lookupRecoveryActions}>
                <TouchableOpacity
                  style={styles.lookupRetryButton}
                  onPress={() => {
                    dispatch({ type: 'LOOKUP_RETRY' });
                    handleScanCandidate(state.failedLookupTrackingId);
                  }}
                >
                  <Icon source="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.lookupRetryButtonText}>Retry Lookup</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.lookupNextButton}
                  onPress={() => {
                    scanLockRef.current = false;
                    dispatch({ type: 'RESET_FOR_NEXT_SCAN' });
                  }}
                >
                  <Text style={styles.lookupNextButtonText}>Scan Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Single Review State */}
          {(state.phase === SCANNER_PHASES.SINGLE_REVIEW ||
            (state.phase === SCANNER_PHASES.SUBMITTING && state.mode === SCANNER_MODES.SINGLE)) && (
            <SingleScanReview
              context={state.currentContext}
              vehicles={vehicles}
              selectedVehicleId={state.selectedVehicleId}
              onSelectVehicle={(vId) => dispatch({ type: 'SET_VEHICLE', payload: vId })}
              loadingVehicles={loadingVehicles}
              onRetryVehicles={loadVehicles}
              onConfirm={handleSingleConfirm}
              onCancel={handleScanNext}
              isSubmitting={state.isSubmitting}
              isOnline={connectivity.isOnline}
              role={user?.role}
            />
          )}

          {/* Batch Panel State */}
          {state.mode === SCANNER_MODES.BATCH &&
            (state.phase === SCANNER_PHASES.BATCH_READY || state.phase === SCANNER_PHASES.BATCH_SUBMITTING) && (
              <BatchScanPanel
                operation={state.batchOperation}
                onSelectOperation={(op) => dispatch({ type: 'SET_BATCH_OPERATION', payload: op })}
                vehicles={vehicles}
                selectedVehicleId={state.batchVehicleId}
                onSelectVehicle={(vId) => dispatch({ type: 'SET_VEHICLE', payload: vId })}
                loadingVehicles={loadingVehicles}
                onRetryVehicles={loadVehicles}
                queue={state.batchQueue}
                onRemoveItem={(id) => dispatch({ type: 'REMOVE_FROM_BATCH', payload: id })}
                onClearBatch={() => dispatch({ type: 'CLEAR_BATCH' })}
                onSubmit={handleBatchSubmit}
                isSubmitting={state.isSubmitting}
                isOnline={connectivity.isOnline}
                role={user?.role}
              />
            )}

          {/* Result State */}
          {state.phase === SCANNER_PHASES.RESULT && (
            <ScanResultPanel
              mode={state.mode}
              singleResult={state.singleResult}
              batchResult={state.batchResult}
              onScanNext={handleScanNext}
              onReturnHome={() => router.replace('/(main)')}
            />
          )}

          {/* Manual Tracking ID Input with Compact GO Button */}
          {state.phase !== SCANNER_PHASES.RESULT &&
            state.phase !== SCANNER_PHASES.SUBMITTING &&
            state.phase !== SCANNER_PHASES.BATCH_SUBMITTING && (
              <View style={styles.manualInputRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="TRK-YYYY-NNNNNN"
                  placeholderTextColor={colors.inkFaint}
                  value={state.manualInput}
                  onChangeText={(val) => dispatch({ type: 'SET_MANUAL_INPUT', payload: val })}
                  onFocus={handleManualInputFocus}
                  autoCapitalize="characters"
                  maxLength={15}
                  returnKeyType="go"
                  onSubmitEditing={handleManualSubmit}
                  editable={connectivity.isOnline}
                />
                <TouchableOpacity
                  style={[styles.goButton, (!connectivity.isOnline || !state.manualInput || !state.manualInput.trim()) && styles.goButtonDisabled]}
                  onPress={handleManualSubmit}
                  disabled={!connectivity.isOnline || !state.manualInput || !state.manualInput.trim()}
                >
                  <Text style={styles.goButtonText}>GO</Text>
                </TouchableOpacity>
              </View>
            )}
        </View>

        {/* Discard Confirmation Modal */}
        <Modal
          visible={state.showDiscardModal}
          transparent
          animationType="fade"
          onRequestClose={handleDiscardCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Icon source="alert" size={32} color={colors.warning} />
              <Text style={styles.modalTitle}>Discard Queued Parcels?</Text>
              <Text style={styles.modalBody}>{getModalCopy()}</Text>
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleDiscardCancel}
                >
                  <Text style={styles.modalCancelButtonText}>Keep Batch</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalDiscardButton}
                  onPress={handleDiscardConfirm}
                >
                  <Text style={styles.modalDiscardButtonText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface
  },
  container: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backButton: {
    padding: spacing.xs
  },
  headerSpacer: {
    minWidth: 40,
    minHeight: 40
  },
  headerTitle: {
    ...typography.eyebrow,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 1.5
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600'
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  networkBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600'
  },
  cameraDivider: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  cameraDividerDisabled: {
    opacity: 0.55
  },
  cameraDividerHandle: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong
  },
  lookupRecoveryCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger
  },
  lookupRecoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  lookupRecoveryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger
  },
  lookupRecoveryMessage: {
    fontSize: 12,
    color: colors.ink,
    marginBottom: spacing.sm
  },
  lookupRecoveryActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  lookupRetryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 8,
    borderRadius: radius.sm,
    gap: 4
  },
  lookupRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  lookupNextButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    borderRadius: radius.sm
  },
  lookupNextButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700'
  },
  bottomPanel: {
    flex: 1,
    backgroundColor: colors.surface
  },
  modeSwitcherRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.canvas
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  modeTabActive: {
    borderBottomColor: colors.accent,
    backgroundColor: colors.surface
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8
  },
  modeTabTextActive: {
    color: colors.accent
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  loadingText: {
    ...typography.body,
    color: colors.inkSoft,
    marginTop: spacing.sm
  },
  manualInputRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs
  },
  manualInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontFamily: 'monospace',
    fontSize: 14,
    color: colors.ink
  },
  goButton: {
    width: 48,
    height: 40,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  goButtonDisabled: {
    backgroundColor: '#D9D8D3'
  },
  goButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center'
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 16,
    color: colors.ink,
    marginTop: spacing.xs,
    marginBottom: spacing.xs
  },
  modalBody: {
    ...typography.body,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%'
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  modalCancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft
  },
  modalDiscardButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  modalDiscardButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
