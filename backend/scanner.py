import subprocess 


def scan_wifi(): # Reads the WiFi signal
    try:
        result = subprocess.run(
            ["netsh", "wlan", "show", "interfaces"],
            capture_output=True,    # Save the output instead of just simply printing it.
            text=True   # To give back as a string NOT bytes
        )
        # All this is doing is running the command that gives you connection stats

        ssid = None
        signal = None
        # 2 empty boxes for values yet to find

        for line in result.stdout.splitlines():
            # gets the full output from netsh, and then cuts into a list of individual lines to loop through one by one.

            if ":" in line:


                key, _, value = line.partition(":")
                # This splits the line into 3 parts at the first colon

                key = key.strip()
                value = value.strip()
                # removes all whitespace from both sides.

                if key == "SSID" and "BSSID" not in key:
                    ssid = value
                    # Grab the network name
                    # Be sure to check "BSSID" not in key since "AP BSSID also contains "SSID"
                
                elif key == "Signal":
                    signal = int(value.replace("%", "").strip())
                    # Grab the signal strength
                    # netsh returns it as whatever percent signal, so we get rid of % and convert to int

        if ssid and signal is not None:
            return {
                "ssid": ssid,
                "signal": signal
            }
                # If we find both values, return them as a clean dictionary 
        else:
            return {"error": "Not connected to Wi-Fi"}
            # If we dont find them, the laptop most likely not connected to Wi-Fi

    except Exception as e:
        return {"error": str(e)}
    # Catch any unexpected errors so the app does not crash

if __name__ == "__main__":
    print(scan_wifi())
    # This only for when you execute this file directly,
    # When main,py imports this file later, this block is ignored