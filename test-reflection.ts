async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/reflection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "TEST TEST TEST" })
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
