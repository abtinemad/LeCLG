async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "enrich_fragments", data: "TEST" })
    });
    if (!res.ok) {
      const text = await res.text();
      console.log("STATUS:", res.status, text);
    } else {
      console.log("OK:", await res.json());
    }
  } catch (err) {
    console.error(err);
  }
}
run();
