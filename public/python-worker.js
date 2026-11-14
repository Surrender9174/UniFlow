/* Runs Python in the browser with Pyodide, isolated in a Web Worker. */
const PYODIDE_VERSION = "0.27.7";
importScripts(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`);

let pyodidePromise = null;
let currentRun = 0;

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({
      indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
    });
  }
  return pyodidePromise;
}

self.onmessage = async (event) => {
  const { id, code } = event.data;
  currentRun = id;
  const send = (stream, text) => self.postMessage({ id, type: "output", stream, text });
  try {
    self.postMessage({ id, type: "status", status: "loading" });
    const pyodide = await getPyodide();
    pyodide.setStdout({ batched: (text) => send("stdout", text) });
    pyodide.setStderr({ batched: (text) => send("stderr", text) });
    pyodide.setStdin({
      stdin: () => {
        throw new Error("input() nu este disponibil în acest executor.");
      },
    });
    self.postMessage({ id, type: "status", status: "running" });
    const globals = pyodide.globals.get("dict")();
    try {
      await pyodide.runPythonAsync(code, { globals });
    } finally {
      globals.destroy();
    }
    self.postMessage({ id, type: "done" });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    self.postMessage({ id, type: "error", text: message });
  }
};
