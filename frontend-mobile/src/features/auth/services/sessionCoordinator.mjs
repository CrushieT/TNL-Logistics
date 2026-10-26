export function createSessionCoordinator() {
  let generation = 0;
  let session = null;
  let pendingWrites = Promise.resolve();
  const supersededError = () => ({ code: 'SESSION_SUPERSEDED', message: 'This sign-in attempt is no longer active.' });
  const coordinator = {
    begin() { generation += 1; session = null; return generation; },
    generation() { return generation; },
    current() { return session ? { ...session, generation } : { generation }; },
    isCurrent(expectedGeneration) { return expectedGeneration === generation; },
    assertCurrent(expectedGeneration) {
      if (expectedGeneration !== generation) throw supersededError();
    },
    matches(snapshot) {
      return snapshot?.generation === generation && snapshot?.token === session?.token
        && snapshot?.userId === session?.userId;
    },
    publish(expectedGeneration, nextSession) {
      coordinator.assertCurrent(expectedGeneration);
      session = nextSession;
    },
    commit(expectedGeneration, write) {
      const result = pendingWrites.then(async () => {
        coordinator.assertCurrent(expectedGeneration);
        const value = await write();
        coordinator.assertCurrent(expectedGeneration);
        return value;
      });
      pendingWrites = result.catch(() => {});
      return result;
    },
  };
  return coordinator;
}

export const authSessionCoordinator = createSessionCoordinator();

export async function commitSessionState(coordinator, generation, write) {
  try {
    return await coordinator.commit(generation, write);
  } catch (error) {
    if (!coordinator.isCurrent(generation)) throw error;
    const invalidatedGeneration = coordinator.begin();
    throw { code: 'SESSION_PERSISTENCE_FAILED', invalidatedGeneration,
      message: 'Session could not be saved. Please sign in again.' };
  }
}

export async function refreshMatchingProfile(coordinator, snapshot, authenticatedUser, fetchProfile, saveProfile) {
  const profile = await fetchProfile();
  if (!coordinator.matches(snapshot)) return null;
  if (profile.userId !== authenticatedUser.userId) {
    throw { code: 'PROFILE_IDENTITY_MISMATCH', message: 'Password sign in is required.' };
  }
  const refreshedUser = { ...authenticatedUser, ...profile };
  await commitSessionState(coordinator, snapshot.generation, async () => {
    if (coordinator.matches(snapshot)) await saveProfile(refreshedUser);
  });
  return coordinator.matches(snapshot) ? refreshedUser : null;
}
