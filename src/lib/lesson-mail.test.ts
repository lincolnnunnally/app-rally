import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lessonAbsoluteUrl, lessonMail } from "./lesson-mail.ts";
import {
  lessonCameOff,
  lessonConfirmNotice,
  lessonDeclineNotice,
  lessonRequestNotice,
} from "./schedule.ts";

const origin = "https://rally.unitedundergod.org";
const whenLabel = "Mon, Jan 25, 10:00 AM";
const lessonUrl = lessonAbsoluteUrl(32, origin);

describe("lesson email links", () => {
  it("points every lesson email at that lesson", () => {
    assert.equal(lessonUrl, "https://rally.unitedundergod.org/app/lessons/32");
    for (const kind of ["request", "confirm", "decline", "cancel", "reschedule"] as const) {
      const mail = lessonMail({
        kind,
        whenLabel,
        detail: "detail",
        lessonUrl,
      });
      assert.match(mail.html, /href="https:\/\/rally\.unitedundergod\.org\/app\/lessons\/32"/);
      assert.match(mail.html, /Open this lesson/);
      assert.doesNotMatch(mail.html, /\/app\/coaches/);
      assert.doesNotMatch(mail.html, /\/app\/desk/);
    }
  });

  it("renders the request, confirm, decline, and cancel-with-reason copies", () => {
    const request = lessonRequestNotice({
      whenLabel,
      playerName: "Kaia",
      coachName: "Coach Sam",
      sport: "tennis",
      span: " · recurring",
    });
    const requestMail = lessonMail({
      kind: "request",
      whenLabel,
      detail: request.body,
      lessonUrl,
    });
    const confirm = lessonConfirmNotice({
      lessonId: 32,
      whenLabel,
      coachName: "Coach Sam",
      playerName: "Kaia",
    });
    const decline = lessonDeclineNotice({
      lessonId: 32,
      whenLabel,
      coachName: "Coach Sam",
      playerName: "Kaia",
    });
    const cancelBody = lessonCameOff({
      whenLabel,
      coachName: "Coach Sam",
      playerName: "Kaia",
      reason: "Rain day",
    });
    const cancelMail = lessonMail({
      kind: "cancel",
      whenLabel,
      detail: cancelBody,
      lessonUrl,
    });

    assert.equal(request.title, "Lesson request");
    assert.equal(request.href, "/app/desk");
    assert.equal(
      request.body,
      "Mon, Jan 25, 10:00 AM: Kaia asked Coach Sam for tennis · recurring.",
    );
    assert.equal(requestMail.subject, "Lesson request");
    assert.match(requestMail.html, /Kaia asked Coach Sam for tennis/);

    assert.equal(confirm.title, "Lesson confirmed");
    assert.equal(confirm.href, "/app/lessons/32");
    assert.notEqual(confirm.href, "/app/coaches");
    assert.equal(
      confirm.body,
      "Mon, Jan 25, 10:00 AM with Coach Sam for Kaia is on the board.",
    );

    assert.equal(decline.title, "Lesson declined");
    assert.equal(decline.href, "/app/lessons/32");
    assert.equal(
      decline.body,
      "Mon, Jan 25, 10:00 AM with Coach Sam for Kaia was declined. Try another window.",
    );

    assert.equal(
      cancelBody,
      "Mon, Jan 25, 10:00 AM with Coach Sam for Kaia came off the board. Rain day",
    );
    assert.equal(cancelMail.subject, "Lesson canceled");
    assert.match(cancelMail.html, /Rain day/);
    assert.match(cancelMail.html, /href="https:\/\/rally\.unitedundergod\.org\/app\/lessons\/32"/);
    assert.doesNotMatch(cancelMail.html, /session note/);
    assert.doesNotMatch(cancelMail.html, /journal/);

    console.log("\n--- request notice ---\n" + `${request.title}\n${request.body}\n${request.href}`);
    console.log("\n--- request email ---\n" + `${requestMail.subject}\n${requestMail.html}`);
    console.log("\n--- confirm notice ---\n" + `${confirm.title}\n${confirm.body}\n${confirm.href}`);
    console.log("\n--- decline notice ---\n" + `${decline.title}\n${decline.body}\n${decline.href}`);
    console.log("\n--- cancel notice ---\n" + `Lesson cancelled\n${cancelBody}\n/app/lessons/32`);
    console.log("\n--- cancel email ---\n" + `${cancelMail.subject}\n${cancelMail.html}`);
  });
});
