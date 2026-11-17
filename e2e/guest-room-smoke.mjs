// Isolated browser tests for no-email private-room entry, mocked auth/backend.
// No production accounts or rooms are created by this test.
import {chromium} from "playwright";
import assert from "node:assert/strict";
const base=process.env.OUTLIER_TEST_URL||"http://127.0.0.1:8000/";
const guestId="a1111111-1111-4111-8111-111111111111";
const roomId="a3333333-3333-4333-8333-333333333333";
const code="aabbccddeeff";
const mockSdk=