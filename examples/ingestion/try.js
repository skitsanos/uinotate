let submissionKey = "";
document.querySelector("#connect").addEventListener("submit", event => {
  event.preventDefault(); submissionKey = document.querySelector("#ingest-key").value.trim();
  document.querySelector("#ingest-key").value = "";
  Uinotate.init({ apiUrl: "/api/feedback", token: () => submissionKey, metadata: { project: "ingestion-example", environment: "local" }, onSuccess: () => { document.querySelector("#connection-status").textContent = "Nudge saved. Open the inbox and refresh to see it."; }, onError: () => { document.querySelector("#connection-status").textContent = "The nudge was not accepted. Check the submission key and try again."; } });
  document.querySelector("#connection-status").textContent = "Widget connected. Open the tab on the right to send a nudge.";
  document.querySelector("#disconnect").hidden = false;
});
document.querySelector("#disconnect").addEventListener("click", () => { Uinotate.destroy(); submissionKey = ""; document.querySelector("#disconnect").hidden = true; document.querySelector("#connection-status").textContent = "Widget disconnected."; });
document.querySelector("#sample-button").addEventListener("click", () => { document.querySelector("#sample-response").textContent = "Just a sample button. Try annotating its spacing or style."; });
