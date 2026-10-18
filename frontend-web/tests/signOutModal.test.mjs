import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');

function elements(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, type));
  const expanded = typeof tree.type === 'function' ? tree.type(tree.props || {}) : null;
  return [
    ...(tree.type === type ? [tree] : []),
    ...(expanded ? elements(expanded, type) : []),
    ...elements(tree.props?.children, type),
  ];
}

function textContent(tree) {
  if (typeof tree === 'string') return tree;
  if (!tree || typeof tree !== 'object') return '';
  if (Array.isArray(tree)) return tree.map(textContent).join(' ');
  return textContent(tree.props?.children);
}

function loadSignOutModal() {
  const source = readFileSync(
    new URL('../src/components/layout/SignOutModal.js', import.meta.url),
    'utf8'
  )
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace('export default function', 'function');

  const compiled = transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-react-jsx'],
  }).code;

  const bindings = {
    React: {
      createElement: (type, props, ...children) => {
        const flatChildren = children.length === 1 && Array.isArray(children[0])
          ? children[0]
          : children;
        return { type, props: { ...props, children: flatChildren } };
      },
    },
    Modal: 'Modal',
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    svg: 'svg',
    path: 'path',
    polyline: 'polyline',
    line: 'line',
    StyleSheet: { create: (val) => val },
    colors: {
      accent: '#C6491F',
      accentSoft: '#F6E7DE',
      ink: '#1A1A1A',
      inkSoft: '#4A4A46',
      inkFaint: '#8A897F',
      border: '#E1DFD5',
      surface: '#FFFFFF',
    },
    fonts: { sans: 'sans-serif', mono: 'monospace' },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { sm: 2, md: 4, pill: 999 },
  };

  return new Function(...Object.keys(bindings), `${compiled}\nreturn SignOutModal;`)(
    ...Object.values(bindings)
  );
}

test('SignOutModal returns null when visible is false', () => {
  const SignOutModal = loadSignOutModal();
  const tree = SignOutModal({ visible: false });
  assert.equal(tree, null);
});

test('SignOutModal renders modal dialog, icon badge, title, and confirmation message when visible is true', () => {
  const SignOutModal = loadSignOutModal();
  const user = {
    name: 'Elena Navarro',
    role: 'ADMINISTRATOR',
  };

  const tree = SignOutModal({
    visible: true,
    user,
    onConfirm: () => {},
    onClose: () => {},
  });

  assert.ok(tree, 'Modal tree must render');
  assert.equal(tree.type, 'Modal');
  assert.equal(tree.props.visible, true);
  assert.equal(tree.props.animationType, 'fade');

  const text = textContent(tree);
  assert.ok(text.includes('Sign Out'), 'Title must be rendered');
  assert.ok(
    text.includes('Are you sure you want to sign out?'),
    'Explanatory message must be present'
  );
  assert.equal(text.includes('Signed in as'), false, 'User badge must not be present');

  const svgs = elements(tree, 'svg');
  assert.ok(svgs.length >= 1, 'Logout SVG icon badge must be rendered');
});

test('SignOutModal renders cleanly when user prop is omitted', () => {
  const SignOutModal = loadSignOutModal();

  const tree = SignOutModal({
    visible: true,
    onConfirm: () => {},
    onClose: () => {},
  });

  assert.ok(tree);
  const text = textContent(tree);
  assert.ok(text.includes('Sign Out'));
  assert.ok(text.includes('Are you sure you want to sign out?'));
  assert.equal(text.includes('Signed in as'), false);
});

test('SignOutModal Cancel and Close (✕) actions trigger onClose callback', () => {
  const SignOutModal = loadSignOutModal();
  let closeCount = 0;

  const tree = SignOutModal({
    visible: true,
    user: { name: 'Admin Staff', role: 'ADMIN' },
    onConfirm: () => {},
    onClose: () => {
      closeCount += 1;
    },
  });

  const pressables = elements(tree, 'Pressable');

  // Find Cancel button by label
  const cancelBtn = pressables.find((p) => p.props.accessibilityLabel === 'Cancel sign out');
  assert.ok(cancelBtn, 'Cancel button must exist');
  cancelBtn.props.onPress();
  assert.equal(closeCount, 1, 'Clicking Cancel must call onClose');

  // Find Close (✕) button by label
  const closeBtn = pressables.find(
    (p) => p.props.accessibilityLabel === 'Close sign out confirmation'
  );
  assert.ok(closeBtn, 'Close (✕) button must exist');
  closeBtn.props.onPress();
  assert.equal(closeCount, 2, 'Clicking ✕ must call onClose');
});

test('SignOutModal backdrop press triggers onClose callback', () => {
  const SignOutModal = loadSignOutModal();
  let closeCalled = false;

  const tree = SignOutModal({
    visible: true,
    user: { name: 'Admin Staff', role: 'ADMIN' },
    onConfirm: () => {},
    onClose: () => {
      closeCalled = true;
    },
  });

  // Outermost Pressable is the backdrop
  const backdrop = Array.isArray(tree.props.children) ? tree.props.children[0] : tree.props.children;
  assert.equal(backdrop.type, 'Pressable');
  backdrop.props.onPress();
  assert.equal(closeCalled, true, 'Pressing backdrop must trigger onClose');
});

test('SignOutModal Confirm action triggers onConfirm callback', () => {
  const SignOutModal = loadSignOutModal();
  let confirmCalled = false;

  const tree = SignOutModal({
    visible: true,
    user: { name: 'Admin Staff', role: 'ADMIN' },
    onConfirm: () => {
      confirmCalled = true;
    },
    onClose: () => {},
  });

  const pressables = elements(tree, 'Pressable');
  const confirmBtn = pressables.find(
    (p) => p.props.accessibilityLabel === 'Confirm Sign Out'
  );
  assert.ok(confirmBtn, 'Confirm button must exist');
  confirmBtn.props.onPress();
  assert.equal(confirmCalled, true, 'Clicking Sign Out must trigger onConfirm');
});

test('Sidebar opens SignOutModal when SIGN OUT button is clicked, and confirming calls logout', () => {
  const source = readFileSync(
    new URL('../src/components/layout/Sidebar.js', import.meta.url),
    'utf8'
  )
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace('export default function', 'function');

  const compiled = transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-react-jsx'],
  }).code;

  let modalVisibleState = false;
  let logoutCalled = false;
  let resetScrollCalled = false;

  const bindings = {
    React: {
      createElement: (type, props, ...children) => {
        const flatChildren =
          children.length === 1 && Array.isArray(children[0]) ? children[0] : children;
        return { type, props: { ...props, children: flatChildren } };
      },
    },
    useState: (init) => [
      modalVisibleState,
      (val) => {
        modalVisibleState = typeof val === 'function' ? val(modalVisibleState) : val;
      },
    ],
    useRef: (init) => ({ current: init }),
    useLayoutEffect: () => {},
    useEffect: () => {},
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    Image: 'Image',
    ScrollView: 'ScrollView',
    StyleSheet: { create: (val) => val },
    useRouter: () => ({ push: () => {} }),
    usePathname: () => '/',
    colors: { sidebar: '#FFFFFF', border: '#E1DFD5', ink: '#1A1A1A', inkFaint: '#8A897F' },
    fonts: { sans: 'sans-serif', mono: 'monospace' },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { sm: 2, md: 4, pill: 999 },
    type: {},
    getCurrentUser: () => ({ username: 'carlos.m', role: 'ADMIN' }),
    logout: () => {
      logoutCalled = true;
    },
    getSavedNavScrollY: () => 0,
    saveNavScrollY: () => {},
    resetNavScrollPosition: () => {
      resetScrollCalled = true;
    },
    SignOutModal: 'SignOutModal',
    require: () => 'logo',
  };

  const Sidebar = new Function(...Object.keys(bindings), `${compiled}\nreturn Sidebar;`)(
    ...Object.values(bindings)
  );

  // 1. Initial render: modal is closed
  let tree = Sidebar({});
  let modalElement = elements(tree, 'SignOutModal')[0];
  assert.ok(modalElement, 'SignOutModal must be present in Sidebar tree');
  assert.equal(modalElement.props.visible, false, 'Modal must initially be closed');

  // 2. Click SIGN OUT button in sidebar footer
  const pressables = elements(tree, 'Pressable');
  const sidebarSignOutBtn = pressables.find(
    (p) => p.props.accessibilityLabel === 'Sign out of Admin Console'
  );
  assert.ok(sidebarSignOutBtn, 'Sidebar SIGN OUT button must exist');
  sidebarSignOutBtn.props.onPress();

  // State should now be open
  assert.equal(modalVisibleState, true, 'Clicking SIGN OUT button must open modal');

  // 3. Re-render with open modal
  tree = Sidebar({});
  modalElement = elements(tree, 'SignOutModal')[0];
  assert.equal(modalElement.props.visible, true, 'Modal visible prop must be true');
  assert.equal(modalElement.props.user.name, 'carlos.m');
  assert.equal(modalElement.props.user.role, 'ADMIN');

  // 4. Confirming sign out in the modal invokes resetNavScrollPosition and logout
  assert.equal(logoutCalled, false, 'logout must not be called prior to confirmation');
  modalElement.props.onConfirm();
  assert.equal(resetScrollCalled, true, 'resetNavScrollPosition must be called on confirm');
  assert.equal(logoutCalled, true, 'logout must be called on confirm');
  assert.equal(modalVisibleState, false, 'Modal state must close on confirm');
});
