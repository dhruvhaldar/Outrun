import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Determine the path to evaluate.py
    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, "api", "evaluate.py");

    // Select the Python executable
    let pythonExec = "python";
    const venvWinPath = path.join(rootDir, "venv", "Scripts", "python.exe");
    const venvUnixPath = path.join(rootDir, "venv", "bin", "python");

    if (fs.existsSync(venvWinPath)) {
      pythonExec = venvWinPath;
    } else if (fs.existsSync(venvUnixPath)) {
      pythonExec = venvUnixPath;
    } else {
      // Fallback to searching system path
      pythonExec = process.platform === "win32" ? "python" : "python3";
    }

    return new Promise<NextResponse>((resolve) => {
      const pyProcess = spawn(pythonExec, [scriptPath]);
      let stdoutData = "";
      let stderrData = "";

      pyProcess.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });

      pyProcess.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      pyProcess.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script exited with code:", code, stderrData);
          resolve(
            NextResponse.json(
              { error: stderrData.trim() || `Python process failed with exit code ${code}` },
              { status: 400 }
            )
          );
          return;
        }

        try {
          const parsed = JSON.parse(stdoutData);
          resolve(NextResponse.json(parsed));
        } catch (e) {
          console.error("Failed to parse Python JSON output:", stdoutData, e);
          resolve(
            NextResponse.json(
              { error: "Invalid response format from portfolio evaluator." },
              { status: 500 }
            )
          );
        }
      });

      // Write input payload and close stdin
      pyProcess.stdin.write(JSON.stringify(payload));
      pyProcess.stdin.end();
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
