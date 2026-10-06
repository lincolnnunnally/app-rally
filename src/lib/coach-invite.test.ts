import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COACH_INVITE_TTL_MS,
  COACH_KEY,
  applyLoginCoachAttribution,
  clearCoachInvite,
  readCoachInvite,
  writeCoachInvite,
  type CoachInviteStorage,
} from "./rally.ts";

function memoryStorage(initial: Record<string, string> = {}): CoachInviteStorage & { dump(): Record<string, string> } {
  const bag = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key]! : null;
    },
    setItem(key, value) {
      bag[key] = value;
    },
    removeItem(key) {
      delete bag[key];
    },
    dump() {
      return { ...bag };
    },
  };
}

describe("coach invite attribution", () => {
  const now = 1_700_000_000_000;

  it("keeps a coach code only for an invite inside the window", () => {
    const storage = memoryStorage();
    writeCoachInvite(storage, " Coach-Ada ", now);
    assert.equal(readCoachInvite(storage, now), "coach-ada");
    assert.equal(readCoachInvite(storage, now + COACH_INVITE_TTL_MS), "coach-ada");
    assert.equal(readCoachInvite(storage, now + COACH_INVITE_TTL_MS + 1), "");
  });

  it("ignores a bare string left in localStorage", () => {
    const storage = memoryStorage({ [COACH_KEY]: "coach-ada" });
    assert.equal(readCoachInvite(storage), "");
  });

  it("ignores a record that did not come from an invite", () => {
    const storage = memoryStorage({
      [COACH_KEY]: JSON.stringify({ code: "coach-ada", source: "login", at: now }),
    });
    assert.equal(readCoachInvite(storage, now), "");
  });

  it("drops the invite on a plain login and refreshes it from the invite link", () => {
    const storage = memoryStorage();
    writeCoachInvite(storage, "coach-ada", now);
    applyLoginCoachAttribution(storage, undefined, now + 1_000);
    assert.equal(readCoachInvite(storage, now + 1_000), "");
    assert.equal(storage.dump()[COACH_KEY], undefined);

    applyLoginCoachAttribution(storage, "Coach-Bea", now + 5_000);
    assert.equal(readCoachInvite(storage, now + 5_000), "coach-bea");
    assert.equal(readCoachInvite(storage, now + 5_000 + COACH_INVITE_TTL_MS + 1), "");
  });

  it("clears the stored invite", () => {
    const storage = memoryStorage();
    writeCoachInvite(storage, "coach-ada", now);
    clearCoachInvite(storage);
    assert.equal(readCoachInvite(storage, now), "");
  });
});
