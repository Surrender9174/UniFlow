self.addEventListener("push", (event) => {
  let message = {};
  const text = event.data ? event.data.text() : "";
  if (text) {
    try {
      message = JSON.parse(text);
    } catch {
      message = { title: "UniFlow", body: text };
    }
  }

  const title = typeof message.title === "string" ? message.title : "UniFlow";
  const body = typeof message.body === "string" ? message.body : "";
  const href = typeof message.href === "string" ? message.href : "/assistant";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedHref = event.notification.data?.href;
  let target = new URL("/assistant", self.location.origin);
  if (typeof requestedHref === "string" && URL.canParse(requestedHref, self.location.origin)) {
    const candidate = new URL(requestedHref, self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === target.origin);
      if (existing) {
        return existing.focus().then(() => existing.navigate(target.href));
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
