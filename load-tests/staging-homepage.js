import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.BASE_URL || "https://staging.quickadmissiongh.com").replace(/\/$/, "");
const profile = (__ENV.LOAD_PROFILE || "smoke").toLowerCase();

function stagesFor(name) {
  if (name === "smoke") {
    return [
      { duration: "30s", target: 10 },
      { duration: "60s", target: 10 },
      { duration: "30s", target: 0 },
    ];
  }

  if (name === "load") {
    return [
      { duration: "2m", target: 50 },
      { duration: "5m", target: 500 },
      { duration: "5m", target: 500 },
      { duration: "2m", target: 0 },
    ];
  }

  if (name === "stress") {
    return [
      { duration: "2m", target: 100 },
      { duration: "5m", target: 1000 },
      { duration: "5m", target: 5000 },
      { duration: "2m", target: 0 },
    ];
  }

  if (name === "spike") {
    return [
      { duration: "2m", target: 500 },
      { duration: "30s", target: 10000 },
      { duration: "3m", target: 10000 },
      { duration: "2m", target: 500 },
      { duration: "2m", target: 0 },
    ];
  }

  if (name === "soak") {
    return [
      { duration: "5m", target: 1000 },
      { duration: "4h", target: 1000 },
      { duration: "5m", target: 0 },
    ];
  }

  if (name === "million") {
    if (__ENV.CONFIRM_MILLION !== "YES" || __ENV.DISTRIBUTED_TEST !== "YES") {
      throw new Error(
        "Million-user testing is locked. It requires CONFIRM_MILLION=YES, DISTRIBUTED_TEST=YES, provider approval, and distributed generators."
      );
    }

    return [
      { duration: "10m", target: 10000 },
      { duration: "20m", target: 100000 },
      { duration: "30m", target: 1000000 },
      { duration: "10m", target: 1000000 },
      { duration: "10m", target: 0 },
    ];
  }

  throw new Error("Unknown LOAD_PROFILE. Use smoke, load, stress, spike, soak, or million.");
}

export const options = {
  stages: stagesFor(profile),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(90)<1000", "p(95)<2000", "p(99)<5000"],
    checks: ["rate>0.99"],
  },
  discardResponseBodies: false,
  tags: {
    app: "quickadmissiongh",
    target: profile,
  },
};

export default function () {
  const response = http.get(`${baseUrl}/`, {
    tags: { endpoint: "homepage" },
    redirects: 3,
  });

  check(response, {
    "homepage returns 2xx": (res) => res.status >= 200 && res.status < 300,
    "homepage contains portal title": (res) => res.body && res.body.includes("QuickAdmissionGH"),
  });

  sleep(Math.random() * 3 + 1);
}
