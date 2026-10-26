import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Compile the actual patched scan methods and receiver against deterministic Android boundaries.
// This verifies native control flow, not Android radio behavior or release APK acceptance.
test('patched Java scan settles once across fallback, overlap, broadcasts and permission failures', () => {
  const source = readFileSync(new URL('../node_modules/react-native-bluetooth-escpos-printer/android/src/main/java/cn/jystudio/bluetooth/RNBluetoothManagerModule.java', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const methods = source.slice(source.indexOf('    private void requireBluetoothPermissions'), source.indexOf('    @ReactMethod\n    public void connect'));
  const deadlineFields = source.slice(source.indexOf('    private static final long SCAN_TIMEOUT_MS'), source.indexOf('    // Name of the connected device'));
  const receiver = source.slice(source.indexOf('    private final BroadcastReceiver discoverReceiver'), source.indexOf('    private void emitRNEvent'));
  const promiseMapField = source.slice(source.indexOf('    private final Map<String, Promise> promiseMap'), source.indexOf('    private static final String PROMISE_ENABLE_BT'));
  assert.ok(methods.includes('discoveryStarted'));
  const directory = mkdtempSync(join(tmpdir(), 'tnl-bluetooth-'));
  try {
    writeFileSync(join(directory, 'ScanHarness.java'), `
import java.util.*;
public class ScanHarness {
  static class Build { static class VERSION { static int SDK_INT = 36; } }
  static class android { static class Manifest { static class permission { static String ACCESS_FINE_LOCATION = "FINE"; } } }
  static class PackageManager { static final int PERMISSION_GRANTED = 0; }
  static class ContextCompat {
    static Set<String> denied = new HashSet<>();
    static int checkSelfPermission(Object context, String permission) { return denied.contains(permission) ? -1 : 0; }
  }
  static class Looper { static Looper getMainLooper() { return new Looper(); } }
  static class Handler {
    static long now;
    static Map<Runnable, Long> deadlines = new LinkedHashMap<>();
    Handler(Looper looper) {}
    boolean postDelayed(Runnable callback, long delay) { deadlines.put(callback, now + delay); return true; }
    void removeCallbacks(Runnable callback) { deadlines.remove(callback); }
    static int pendingCount() { return deadlines.size(); }
    static void advanceBy(long duration) {
      now += duration;
      for (Map.Entry<Runnable, Long> entry : new ArrayList<>(deadlines.entrySet())) {
        if (entry.getValue() <= now && deadlines.remove(entry.getKey()) != null) entry.getKey().run();
      }
    }
  }
  @interface ReactMethod {}
  static class ModuleBase { public void invalidate() {} }
  static class JSONObject {
    Map<String, Object> values = new LinkedHashMap<>();
    void put(String key, Object value) { values.put(key, value); }
    public String toString() { return values.toString(); }
  }
  static class JSONArray {
    List<Object> values = new ArrayList<>();
    int length() { return values.size(); }
    void put(Object value) { values.add(value); }
    public String toString() { return values.toString(); }
  }
  static class WritableMap { void putString(String key, String value) {} }
  static class Arguments { static WritableMap createMap() { return new WritableMap(); } }
  static class Promise {
    int settlements; Object result; String code; String message;
    boolean failResolve;
    void resolve(Object value) {
      settlements++; result = value;
      if (failResolve) throw new IllegalStateException("Bridge closed while resolving");
    }
    void reject(String code, String message, Throwable... error) { settlements++; this.code = code; this.message = message; }
  }
  static class BluetoothDevice {
    static final String ACTION_FOUND = "FOUND", EXTRA_DEVICE = "DEVICE";
    static final int BOND_BONDED = 12;
    boolean failName;
    int getBondState() { return 0; }
    String getName() { if (failName) throw new SecurityException(); return "XP-470B"; }
    String getAddress() { return "AA:BB"; }
  }
  static class BluetoothAdapter {
    static final String ACTION_DISCOVERY_STARTED = "STARTED", ACTION_DISCOVERY_FINISHED = "FINISHED", ACTION_STATE_CHANGED = "STATE_CHANGED", EXTRA_STATE = "STATE";
    static final int STATE_ON = 12, STATE_TURNING_OFF = 13, STATE_OFF = 10;
    boolean enabled = true, discovering, starts, failStart, failBonded, disableOnStart, revokeOnStart;
    int cancellations;
    Set<BluetoothDevice> paired = new LinkedHashSet<>();
    boolean isEnabled() { return enabled; }
    boolean isDiscovering() { return discovering; }
    Set<BluetoothDevice> getBondedDevices() { if (failBonded) throw new SecurityException(); return paired; }
    boolean startDiscovery() {
      if (failStart) throw new SecurityException();
      if (disableOnStart) enabled = false;
      if (revokeOnStart) ContextCompat.denied.add("android.permission.BLUETOOTH_SCAN");
      if (starts) discovering = true;
      return starts;
    }
    boolean cancelDiscovery() { cancellations++; discovering = false; return true; }
  }
  static class Context {
    int receiverRemovals;
    void unregisterReceiver(BroadcastReceiver receiver) { receiverRemovals++; }
  }
  static class BluetoothService {
    int observerRemovals;
    void removeStateObserver(RNBluetoothManagerModule manager) { observerRemovals++; }
  }
  static class Intent {
    String action; BluetoothDevice device; int state;
    Intent(String action, BluetoothDevice device) { this(action, device, BluetoothAdapter.STATE_ON); }
    Intent(String action, BluetoothDevice device, int state) { this.action = action; this.device = device; this.state = state; }
    String getAction() { return action; }
    BluetoothDevice getParcelableExtra(String key) { return device; }
    int getIntExtra(String key, int fallback) { return state; }
  }
  abstract static class BroadcastReceiver { public abstract void onReceive(Context context, Intent intent); }
  static class RNBluetoothManagerModule extends ModuleBase {
    Context reactContext = new Context();
    BluetoothService mService = new BluetoothService();
${promiseMapField}
    static final String PROMISE_SCAN = "SCAN", EVENT_BLUETOOTH_NOT_SUPPORT = "UNSUPPORTED", EVENT_DEVICE_ALREADY_PAIRED = "PAIRED", EVENT_DEVICE_FOUND = "FOUND", EVENT_DEVICE_DISCOVER_DONE = "DONE";
    JSONArray pairedDeivce = new JSONArray(), foundDevice = new JSONArray();
    boolean scanDiscoveryStarted;
${deadlineFields}
    BluetoothAdapter adapter = new BluetoothAdapter();
    BluetoothAdapter getBluetoothAdapter() { return adapter; }
    void emitRNEvent(String event, WritableMap params) {}
    boolean objectFound(JSONObject device) { return false; }
${methods}
${receiver}
    void broadcast(String action, BluetoothDevice device) {
      if (adapter != null && BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) adapter.discovering = false;
      discoverReceiver.onReceive(new Context(), new Intent(action, device));
    }
    void broadcastState(int state) { discoverReceiver.onReceive(new Context(), new Intent("STATE_CHANGED", null, state)); }
    void broadcastStaleFinish() { discoverReceiver.onReceive(new Context(), new Intent("FINISHED", null)); }
  }
  static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
  static Promise scan(RNBluetoothManagerModule manager) { Promise promise = new Promise(); manager.scanDevices(promise); return promise; }
  static void settled(RNBluetoothManagerModule manager, Promise promise, String code) {
    settled(manager, promise, code, 0);
  }
  static void settled(RNBluetoothManagerModule manager, Promise promise, String code, int expectedTimers) {
    check(promise.settlements == 1, "must settle once");
    check(Objects.equals(code, promise.code), "unexpected code: " + promise.code);
    check(manager.promiseMap.isEmpty(), "pending scan leaked");
    check(Handler.pendingCount() == expectedTimers, "scan deadline leaked or removed from another module");
    manager.broadcast("STARTED", null); manager.broadcast("FINISHED", null);
    check(promise.settlements == 1, "late broadcast settled again");
  }
  public static void main(String[] args) {
    RNBluetoothManagerModule manager = new RNBluetoothManagerModule();
    manager.adapter.paired.add(new BluetoothDevice());
    Promise fallback = scan(manager);
    settled(manager, fallback, null);
    check(fallback.result.toString().contains("discoveryStarted=false"), "fallback metadata");
    check(fallback.result.toString().contains("XP-470B"), "paired printer missing");
    check(fallback.result.toString().contains("found=[]"), "fallback found must be empty");
    manager.adapter.paired.clear();
    Promise empty = scan(manager); settled(manager, empty, "DISCOVER");
    check(empty.message.contains("NOT_STARTED") && empty.message.contains("Android Settings"), "refusal guidance");
    manager.adapter.enabled = false; settled(manager, scan(manager), "BT NOT ENABLED");
    manager.adapter = null; settled(manager, scan(manager), "UNSUPPORTED");
    manager.adapter = new BluetoothAdapter(); manager.adapter.paired.add(new BluetoothDevice());
    for (String permission : List.of("android.permission.BLUETOOTH_SCAN", "android.permission.BLUETOOTH_CONNECT")) {
      ContextCompat.denied.add(permission); settled(manager, scan(manager), "PERMISSION_DENIED"); ContextCompat.denied.clear();
    }
    Build.VERSION.SDK_INT = 30; ContextCompat.denied.add("FINE");
    settled(manager, scan(manager), "PERMISSION_DENIED"); ContextCompat.denied.clear(); Build.VERSION.SDK_INT = 36;
    manager.adapter.failStart = true; settled(manager, scan(manager), "PERMISSION_DENIED"); manager.adapter.failStart = false;
    manager.adapter.disableOnStart = true; settled(manager, scan(manager), "BT NOT ENABLED"); manager.adapter.disableOnStart = false; manager.adapter.enabled = true;
    manager.adapter.revokeOnStart = true; settled(manager, scan(manager), "PERMISSION_DENIED"); manager.adapter.revokeOnStart = false; ContextCompat.denied.clear();
    manager.adapter.failBonded = true; settled(manager, scan(manager), "PERMISSION_DENIED"); manager.adapter.failBonded = false;
    manager.adapter.paired.iterator().next().failName = true; settled(manager, scan(manager), "PERMISSION_DENIED");
    manager.adapter.paired.clear(); manager.adapter.starts = true;
    Promise pending = scan(manager); check(pending.settlements == 0, "discovery settled too early");
    check(Handler.pendingCount() == 1, "active scan needs a deadline");
    Promise overlap = scan(manager); check("SCAN_IN_PROGRESS".equals(overlap.code), "overlap accepted");
    check(pending.settlements == 0 && manager.promiseMap.get("SCAN") == pending, "overlap replaced pending scan");
    manager.broadcast("FINISHED", null); check(pending.settlements == 0, "stale finish accepted");
    manager.broadcast("STARTED", null); manager.broadcast("FOUND", new BluetoothDevice()); manager.broadcast("FINISHED", null);
    settled(manager, pending, null);
    check(pending.result.toString().contains("discoveryStarted=true") && pending.result.toString().contains("XP-470B"), "complete discovery data");
    Promise failedDelivery = scan(manager); failedDelivery.failResolve = true;
    manager.broadcast("STARTED", null); manager.broadcast("FINISHED", null);
    settled(manager, failedDelivery, null);
    Promise revoked = scan(manager); manager.broadcast("STARTED", null);
    BluetoothDevice unreadable = new BluetoothDevice(); unreadable.failName = true;
    manager.broadcast("FOUND", unreadable); settled(manager, revoked, "PERMISSION_DENIED");
    Promise revokedPermission = scan(manager); ContextCompat.denied.add("android.permission.BLUETOOTH_SCAN");
    manager.broadcast("STARTED", null); settled(manager, revokedPermission, "PERMISSION_DENIED"); ContextCompat.denied.clear();
    manager.adapter.discovering = true; settled(manager, scan(manager), "SCAN_IN_PROGRESS");
    manager.adapter.discovering = false;
    Promise missingBroadcast = scan(manager);
    check(Handler.pendingCount() == 1, "accepted scan needs one deadline");
    Handler.advanceBy(44999);
    check(missingBroadcast.settlements == 0, "scan expired before deadline");
    Runnable expiredCallback = Handler.deadlines.keySet().iterator().next();
    Handler.advanceBy(1);
    settled(manager, missingBroadcast, "DISCOVER");
    check(missingBroadcast.message.contains("timed out"), "timeout guidance missing");
    check(manager.adapter.cancellations == 1, "timed out discovery not cancelled");
    Promise replacement = scan(manager);
    expiredCallback.run();
    check(replacement.settlements == 0, "old deadline settled replacement scan");
    manager.broadcastStaleFinish();
    check(replacement.settlements == 0, "old finish settled replacement scan");
    manager.broadcast("STARTED", null);
    manager.broadcast("FINISHED", null);
    settled(manager, replacement, null);
    Promise revokedWithoutBroadcast = scan(manager);
    ContextCompat.denied.add("android.permission.BLUETOOTH_SCAN");
    Handler.advanceBy(45000);
    settled(manager, revokedWithoutBroadcast, "PERMISSION_DENIED");
    ContextCompat.denied.clear(); manager.adapter.discovering = false;
    Promise poweredOffWithoutBroadcast = scan(manager);
    manager.adapter.enabled = false;
    Handler.advanceBy(45000);
    settled(manager, poweredOffWithoutBroadcast, "BT NOT ENABLED");
    manager.adapter.enabled = true; manager.adapter.discovering = false;
    Promise poweringOff = scan(manager);
    manager.broadcastState(BluetoothAdapter.STATE_TURNING_OFF);
    settled(manager, poweringOff, "BT NOT ENABLED");
    manager.adapter.discovering = false;
    Promise invalidated = scan(manager);
    RNBluetoothManagerModule replacementModule = new RNBluetoothManagerModule();
    replacementModule.adapter.starts = true;
    Promise replacementModuleScan = scan(replacementModule);
    manager.invalidate();
    settled(manager, invalidated, "DISCOVER", 1);
    check(manager.reactContext.receiverRemovals == 1, "receiver not unregistered");
    check(manager.mService.observerRemovals == 1, "service observer not removed");
    check(replacementModuleScan.settlements == 0, "old module settled replacement module scan");
    Handler.advanceBy(45000);
    settled(replacementModule, replacementModuleScan, "DISCOVER");
    System.out.println("Native scan scenarios passed.");
  }
}
`);
    const compilation = spawnSync('javac', ['-encoding', 'UTF-8', 'ScanHarness.java'], { cwd: directory, encoding: 'utf8' });
    assert.equal(compilation.status, 0, compilation.stderr || compilation.error?.message);
    const execution = spawnSync('java', ['-cp', directory, 'ScanHarness'], { encoding: 'utf8' });
    assert.equal(execution.status, 0, execution.stderr || execution.error?.message);
    assert.match(execution.stdout, /Native scan scenarios passed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('patched Java disconnect stops service and clears pending connection', () => {
  const source = readFileSync(new URL('../node_modules/react-native-bluetooth-escpos-printer/android/src/main/java/cn/jystudio/bluetooth/RNBluetoothManagerModule.java', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(source.includes('public void disconnect(String address, final Promise promise)'));
  assert.ok(source.includes('The printer may be connected to another device or out of range.'));
  const directory = mkdtempSync(join(tmpdir(), 'tnl-bluetooth-disconnect-'));
  try {
    writeFileSync(join(directory, 'DisconnectHarness.java'), `
import java.util.*;
public class DisconnectHarness {
  static class Promise {
    int settlements; Object result; String code; String message;
    void resolve(Object value) { settlements++; result = value; }
    void reject(String code, String message, Throwable... error) { settlements++; this.code = code; this.message = message; }
  }
  static class Log {
    static int e(String tag, String msg) { return 0; }
    static int e(String tag, String msg, Throwable tr) { return 0; }
  }
  static class BluetoothService {
    int stops = 0;
    void stop() { stops++; }
  }
  static class DisconnectTestModule {
    private static final String TAG = "BluetoothManager";
    private static final String PROMISE_CONNECT = "CONNECT";
    private final Map<String, Promise> promiseMap = Collections.synchronizedMap(new HashMap<String, Promise>());
    private BluetoothService mService = new BluetoothService();
    private String mConnectedDeviceName = "XP-470B";

    public void disconnect(String address, final Promise promise) {
        try {
            Promise pendingConnect = promiseMap.remove(PROMISE_CONNECT);
            if (pendingConnect != null) {
                pendingConnect.reject("CANCELLED", "Connection cancelled by disconnect request.");
            }
            if (mService != null) {
                mService.stop();
            }
            mConnectedDeviceName = null;
            promise.resolve(true);
        } catch (Exception exception) {
            Log.e(TAG, "Error disconnecting bluetooth service", exception);
            promise.reject("DISCONNECT_FAILED", "Failed to disconnect printer.", exception);
        }
    }
  }

  static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }

  public static void main(String[] args) {
    DisconnectTestModule module = new DisconnectTestModule();
    Promise connectPromise = new Promise();
    module.promiseMap.put("CONNECT", connectPromise);

    Promise disconnectPromise = new Promise();
    module.disconnect("AA:BB:CC", disconnectPromise);

    check(disconnectPromise.settlements == 1, "disconnect promise must resolve");
    check(Boolean.TRUE.equals(disconnectPromise.result), "disconnect promise result must be true");
    check(connectPromise.settlements == 1, "pending connect must be cancelled");
    check("CANCELLED".equals(connectPromise.code), "cancelled code mismatch: " + connectPromise.code);
    check(module.mService.stops == 1, "service stop must be called once");
    check(module.mConnectedDeviceName == null, "connected device name must be cleared");
    check(module.promiseMap.isEmpty(), "promiseMap must be empty");

    Promise secondDisconnect = new Promise();
    module.disconnect("", secondDisconnect);
    check(secondDisconnect.settlements == 1 && Boolean.TRUE.equals(secondDisconnect.result), "second disconnect must succeed");
    check(module.mService.stops == 2, "service stop must be called again");

    System.out.println("Native disconnect scenarios passed.");
  }
}
`);
    const compilation = spawnSync('javac', ['-encoding', 'UTF-8', 'DisconnectHarness.java'], { cwd: directory, encoding: 'utf8' });
    assert.equal(compilation.status, 0, compilation.stderr || compilation.error?.message);
    const execution = spawnSync('java', ['-cp', directory, 'DisconnectHarness'], { encoding: 'utf8' });
    assert.equal(execution.status, 0, execution.stderr || execution.error?.message);
    assert.match(execution.stdout, /Native disconnect scenarios passed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
