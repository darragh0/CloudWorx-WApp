#!/usr/bin/env python3

"""Cross-Platform CloudWorx Setup Script"""

from __future__ import annotations

import ctypes
import platform
import re
import subprocess as sp
import sys
from functools import partial
from os import chdir, getenv
from pathlib import Path
from shutil import which
from time import sleep

__version__ = "0.1.0"

ROOT_DIR: Path = Path(__file__).parents[1]
ENV_KEYS: set[str] = {
    "RECAPTCHA_SECRET_KEY",
    "ARGON_MEM_COST",
    "ARGON_TIME_COST",
    "ARGON_THREADS",
}


class Color:
    RED = "\033[91m"
    GRN = "\033[92m"
    YLW = "\033[93m"
    BLU = "\033[94m"
    MAG = "\033[95m"
    CYN = "\033[96m"
    DIM = "\033[2m"
    BLD = "\033[1m"
    RST = "\033[0m"

    @staticmethod
    def _strip_colors() -> None:
        """Strip ANSI codes for platforms not supporting them"""

        if platform.system() == "Windows" and not getenv("ANSICON"):
            for attr in dir(Color):
                if not attr.startswith("_") and attr != "strip_colors":
                    setattr(Color, attr, "")

    @staticmethod
    def check_platform() -> None:
        """Initialize color settings based on platform"""

        if platform.system() == "Windows":
            # Enable ANSI colors on Windows 10+
            try:
                kernel32 = ctypes.windll.kernel32
                kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
            except Exception:  # noqa: BLE001
                Color._strip_colors()


def _print(
    msg: str,
    *,
    prefix: str | None = None,
    indent: int = 0,
    color: str,
    end: str = "\n",
) -> None:
    """Print message with optional indentation and color"""

    if color != Color.DIM:
        msg = re.sub(r"`(.*?)`", rf"{Color.RST}`\1`{color}", msg)

    if prefix is None:
        prefix = ""
    else:
        prefix += " "

    padding = " " * indent
    print(f"{padding}{color}{prefix}{msg}{Color.RST}", end=end, flush=True)


def pwindows_tip() -> None:
    _print(
        r'Start-Process wt.exe -Verb RunAs -ArgumentList "python $PWD\init-scripts\init.py"',
        indent=4,
        color=Color.DIM,
    )


def psec(title: str) -> None:
    """Print section header"""
    print(f"\n{Color.BLD}[{title}]{Color.RST}")


def pbanner() -> None:
    """Display the CloudWorx banner"""
    banner = (
        f"\n\n    {Color.BLU}▄▄▄▄{Color.RST}   {Color.BLU}▄▄▄▄{Color.RST}                                {Color.DIM}"
        f"▄▄{Color.RST} {Color.DIM}▄▄{Color.RST}      {Color.BLU}▄▄{Color.RST}\n"
        f"  {Color.BLU}██▀▀▀▀█{Color.RST}  {Color.BLU}▀▀██{Color.RST}                                {Color.DIM}█"
        f"{Color.BLU}█{Color.RST} {Color.BLU}██{Color.RST}      {Color.BLU}██{Color.RST}\n"
        f" {Color.BLU}██▀{Color.RST}         {Color.RST}██{Color.RST}       {Color.RST}▄█{Color.DIM}███▄{Color.RST}   "
        f"{Color.DIM}██{Color.RST}    {Color.DIM}██{Color.RST}   {Color.BLU}▄███▄██{Color.RST} {Color.BLU}▀█▄"
        f"{Color.RST} {Color.BLU}██{Color.RST} {Color.BLU}▄█▀{Color.RST}  {Color.BLU}▄████▄{Color.RST}    {Color.RST}"
        f"██▄████{Color.RST}  {Color.RST}▀██{Color.RST}  {Color.RST}██{Color.DIM}▀{Color.RST}\n"
        f" {Color.RST}██{Color.RST}          {Color.RST}██{Color.RST}      {Color.DIM}██▀{Color.RST}  {Color.DIM}▀██"
        f"{Color.RST}  {Color.DIM}█{Color.BLU}█{Color.RST}    {Color.BLU}██{Color.RST}  {Color.BLU}██▀{Color.RST}  "
        f"{Color.BLU}▀█{Color.BLU}█{Color.RST}  {Color.BLU}██{Color.RST} {Color.BLU}██{Color.RST} {Color.BLU}██"
        f"{Color.RST}  {Color.BLU}██▀{Color.RST}  {Color.RST}▀██{Color.RST}   {Color.RST}██▀{Color.RST}        "
        f"{Color.DIM}████{Color.RST}\n {Color.RST}██▄{Color.RST}         {Color.DIM}██{Color.RST}      {Color.DIM}"
        f"██{Color.RST}    {Color.BLU}██{Color.RST}  {Color.BLU}██{Color.RST}    {Color.BLU}██{Color.RST}  {Color.BLU}"
        f"██{Color.RST}    {Color.BLU}██{Color.RST}  {Color.BLU}███▀▀{Color.RST}███{Color.RST}  {Color.RST}██"
        f"{Color.RST}    {Color.RST}██{Color.RST}   {Color.DIM}██{Color.RST}         {Color.DIM}▄██▄{Color.RST}\n"
        f"  {Color.DIM}██▄▄▄▄█{Color.RST}    {Color.DIM}██▄{Color.BLU}▄▄{Color.RST}   {Color.BLU}▀██▄▄██▀{Color.RST}  "
        f"{Color.BLU}█{Color.BLU}█▄▄▄███{Color.RST}  {Color.BLU}▀██▄▄██{Color.RST}█{Color.RST}  {Color.RST}███"
        f"{Color.RST}  {Color.RST}███{Color.RST}  {Color.RST}▀██{Color.DIM}▄▄██▀{Color.RST}   {Color.DIM}██"
        f"{Color.RST}        {Color.BLU}▄█▀▀█▄{Color.RST}\n    {Color.DIM}▀▀▀▀{Color.RST}      {Color.BLU}▀▀▀▀"
        f"{Color.RST}     {Color.BLU}▀{Color.BLU}▀▀▀{Color.RST}     {Color.BLU}▀▀▀▀{Color.RST} {Color.BLU}"
        f"▀▀{Color.RST}    {Color.RST}▀▀▀{Color.RST} {Color.RST}▀▀{Color.RST}  {Color.RST}▀▀▀{Color.RST}  "
        f"{Color.DIM}▀▀▀{Color.RST}    {Color.DIM}▀▀▀▀{Color.RST}     {Color.BLU}▀▀{Color.RST}       "
        f"{Color.BLU}▀▀▀{Color.RST}  {Color.BLU}▀▀{Color.BLU}▀{Color.RST}\n\n"
    )

    for line in banner.splitlines():
        sleep(0.025)
        print(line, flush=True)


psuccess = partial(_print, prefix="✓", color=Color.GRN)
pwarn = partial(_print, prefix="!", color=Color.YLW)
perr = partial(_print, prefix="✗", color=Color.RED)
pinfo = partial(_print, prefix="→", color=Color.BLU)


def is_admin() -> bool:
    """Check if the script is running with administrator privileges on Windows"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:  # noqa: BLE001
        return False


def yn_prompt(prompt: str, indent: int = 0) -> bool:
    """Ask user y/n question"""

    padding = " " * indent
    ans = input(f"{padding}{prompt} (y/n): ")
    return ans.lower().strip() == "y"


def run_cmd(cmd: str, *, indent: int = 0, output: bool = True) -> bool:  # noqa: C901, PLR0912
    """Run a shell command with or without its output. Returns True on success, False on failure."""

    try:
        process = sp.Popen(  # noqa: S602
            cmd,
            shell=True,
            stdout=sp.PIPE if output else None,
            stderr=sp.PIPE if output else None,
            stdin=sys.stdin,
            text=True,
            encoding="utf-8",
        )

        if output:
            printed = False
            starts_w_progress = False

            for line in process.stdout:
                if line := line.strip():
                    printed = True
                    if line.startswith("Progress"):
                        starts_w_progress = True
                    elif starts_w_progress:
                        starts_w_progress = False
                        print()
                    _print(
                        f" | {line}",
                        indent=indent,
                        color=Color.DIM,
                        end="\r" if starts_w_progress else "\n",
                    )

            return_code = process.wait()

            if not printed:
                for line in process.stderr:
                    if line := line.strip():
                        if line.startswith("Progress"):
                            starts_w_progress = True
                        elif starts_w_progress:
                            starts_w_progress = False
                            print()
                        _print(
                            f" | {line}",
                            indent=indent,
                            color=Color.DIM,
                            end="\r" if starts_w_progress else "\n",
                        )
        else:
            return_code = process.wait()

    except Exception as e:  # noqa: BLE001
        print(e.__class__.__name__, e)
        perr(f"Failed to run command `{cmd}`: {e}", indent=indent)
        return False

    else:
        return return_code == 0


def install_mkcert() -> bool:
    """Install mkcert using common package managers"""

    pinfo("Installing mkcert...", indent=2)

    install_cmds = {
        "brew": "brew install mkcert",
        "choco": "choco install mkcert -y",
        "scoop": "scoop install mkcert",
        "apt": "sudo apt update && sudo apt install -y mkcert",
        "dnf": "sudo dnf install -y mkcert",
        "pacman": "sudo pacman -S mkcert",
    }

    for pm, cmd in install_cmds.items():
        if which(pm):
            pinfo(f"Installing via {pm}", indent=4)
            if run_cmd(cmd, indent=6):
                psuccess("mkcert installed successfully", indent=4)
                return True

    perr("No supported package manager found", indent=4)
    pinfo("Please install mkcert manually (https://github.com/FiloSottile/mkcert)", indent=4)
    return False


def check_pwd() -> None:
    """Check and set cwd to root directory"""

    psec("Directory")
    cwd = Path.cwd()
    pinfo(f"Current dir: `{cwd}`", indent=2)

    if Path(ROOT_DIR) != cwd:
        pwarn("Current dir is not the root directory", indent=2)
        pinfo(f"Changing root dir: `{ROOT_DIR}`", indent=2)
        chdir(ROOT_DIR)

    psuccess("Current dir is valid", indent=2)


def check_env() -> None:
    """Check and validate `.env` file"""

    psec("Environment")
    env_file = Path(".env")

    if env_file.exists():
        with env_file.open(encoding="utf-8") as f:
            err = False
            for line in f:
                if line.startswith("#") or not line.strip():
                    continue
                if "=" not in line:
                    err = True
                    perr(f"Invalid line in `.env`: {line.strip()}", indent=2)
                    continue
                key, val = line.split("=", 1)
                if key.strip() not in ENV_KEYS:
                    err = True
                    perr(f"Unknown key in `.env`: {key} (expected one of {', '.join(ENV_KEYS)})", indent=2)
                    continue
                if not val.strip():
                    err = True
                    perr(f"Empty value for key `.env`: {key}", indent=2)
                    continue

        if err:
            sys.exit(2)

        psuccess("`.env` is valid", indent=2)

    else:
        pwarn("No `.env` file found.", indent=2)

        if not Path(".env.example").exists():
            perr("Missing `.env.example` file. Cannot create `.env`", indent=2)
            sys.exit(2)

        env_content = Path(".env.example").read_text(encoding="utf-8")
        env_file.write_text(env_content[env_content.find("\n") + 1 :], encoding="utf-8")

        pinfo("Created `.env` from `.env.example`", indent=2)
        perr("Missing required values in `.env` (contact darragh0)", indent=2)
        sys.exit(2)


def check_certs() -> None:
    """Check/install certificates"""

    psec("Certificates")
    certs_dir = ROOT_DIR / "certs"

    if not certs_dir.exists():
        Path("certs").mkdir(parents=True, exist_ok=True)
        pinfo("Created `certs` dir", indent=2)

    if not which("mkcert"):
        perr("mkcert is not installed", indent=2)
        install = yn_prompt("Install mkcert?", indent=2)
        if not install:
            perr("Please install mkcert to continue (https://github.com/FiloSottile/mkcert)")
            sys.exit(3)

        if not install_mkcert():
            perr("Failed to install mkcert. Please install manually (https://github.com/FiloSottile/mkcert)")
            sys.exit(3)
    else:
        psuccess("mkcert is installed", indent=2)

    pinfo("Installing local CA", indent=2)
    if not run_cmd("mkcert -install", indent=4):
        perr("Failed to install local CA", indent=2)
        sys.exit(3)

    both_files_exist = Path(certs_dir / "localhost-key.pem").exists() and Path(certs_dir / "localhost.pem").exists()
    if not both_files_exist:
        pinfo("Generating certificates", indent=2)
        if not run_cmd("mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost", indent=4):
            perr("Failed to generate certificates", indent=2)
            sys.exit(3)

    psuccess("Certificates are valid", indent=2)


def check_nodejs() -> None:
    """Check/install Node.js dependencies"""

    psec("Dependencies")

    if not Path("package.json").exists():
        perr("Missing required `package.json` file", indent=2)
        sys.exit(4)

    nodejs = which("node")
    if not nodejs:
        perr("Node.js is not installed", indent=2)
        perr("Please install it to continue (https://nodejs.org)", indent=2)
        sys.exit(4)

    pinfo("Installing dependencies", indent=2)
    if not run_cmd("npm install", indent=4):
        perr("Failed to install npm dependencies", indent=2)
        sys.exit(4)


def main() -> None:
    Color.check_platform()

    win = False
    if platform.system() == "Windows" and not is_admin():
        perr("This script requires administrator privileges on Windows")
        perr("Please run again as admin")
        print()
        pinfo("Tip: Run the following in Powershell if wt.exe is available: ")
        pwindows_tip()
        sys.exit(1)
    elif platform.system() == "Windows":
        win = True

    pbanner()
    check_pwd()
    check_env()
    check_certs()
    check_nodejs()

    print()
    pinfo("Run `npm run serve` to start the server")
    if win:
        print()
        sp.run("pause", shell=True, check=False)  # noqa: S602, S607


if __name__ == "__main__":
    main()
