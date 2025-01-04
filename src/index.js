import Alpine from "alpinejs";
import Interval from "@alpine-collective/toolkit-interval";
import Cookies from "js-cookie";

window.Alpine = Alpine;
window.Cookies = Cookies;

Alpine.data("cookie", () => ({
  cookies: [],
  isSecure: true,
  isPartitioned: true,
  urlSearch: "",
  differentSite(baseUrl, type) {
    const url = new URL(window.location.href);
    const fragment = btoa(`${url.search}${url.hash}`);
    return `${baseUrl}/${type}/${fragment}`;
  },
  isSetText(attr) {
    return `${attr} = <b>${attr == "partitioned" ? this.isPartitioned.toString() : this.isSecure.toString()}</b>`;
  },
  initializeCheckbox() {
    const url = new URL(window.location.href);
    this.isSecure = url.searchParams?.get("sc") === "false" ? false : true;
    this.isPartitioned = url.searchParams?.get("pc") === "false" ? false : true;
    this.urlSearch = url.search;
  },
  updateCookies() {
    this.cookies = Object.getOwnPropertyNames(Cookies.get());
  },
  cookieEmoji(name) {
    return this.hasCookie(name) ? "🍪" : "";
  },
  hasCookie(name) {
    this.updateCookies();
    return this.cookies.includes(name);
  },
  deleteAllCookies() {
    this.deleteCookies();
    this.postMessageIFrames(["deleteCookies", []]);
  },
  reset() {
    this.isSecure = true;
    this.isPartitioned = true;
    const url = new URL(window.location.href);
    if (url.search !== "") {
      url.search = "";
      history.replaceState(null, "", url.toString());
    }
    this.deleteAllCookies();
  },
  toggle(attr, _) {
    let key;
    if (attr === "isSecure") {
      key = "sc";
    } else if (attr === "isPartitioned") {
      key = "pc";
    } else {
      throw new Error("Invalid attribute!");
    }

    this.deleteAllCookies();
    const url = new URL(window.location.href);

    if (this[attr]) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, "false");
    }

    this.urlSearch = url.search;
    history.replaceState(null, "", url.toString());
  },
  postMessageIFrames(msg) {
    const iframes = document.querySelectorAll("iframe.surveymojiIFrame");
    iframes.forEach((iframe) => {
      if (iframe) {
        iframe.contentWindow?.postMessage(msg, "*");
      } else {
        console.error("Unable to find iframe.");
      }
    });
  },
  receiveMessage(msg) {
    if (msg === null) {
      console.error("Received data is not in the expected format.");
      return;
    }

    const [func, args] = msg;
    if (typeof func !== "string" || !Array.isArray(args)) {
      // ignore this message
      return;
    }

    const funcToCall = this[func];
    if (typeof funcToCall === "function") {
      funcToCall(...args);
    } else {
      console.error(`Function ${func} is not defined or not callable.`);
    }
  },
  deleteCookies() {
    Object.getOwnPropertyNames(Cookies.get()).forEach((c) => {
      if (!c.includes("sameSite")) {
        return;
      }
      try {
        const attr = JSON.parse(atob(Cookies.get(c) || ""));
        Cookies.remove(c, attr);
      } catch (error) {
        console.error("Error parsing cookie value as json", c, error);
      }
    });
  },
  ajax(method = "get") {
    const args = [
      `/${method}`,
      "cookieTable",
      method.toUpperCase(),
      this.isSecure,
      this.isPartitioned,
    ];
    this.updateWithContent(...args);
    this.postMessageIFrames(["updateWithContent", args]);
  },
  updateWithContent(url, className, method, isSecure, isPartitioned) {
    const options = {
      method: method,
    };
    const formData = new URLSearchParams();
    const params = new URLSearchParams();

    if (!isSecure) {
      params.append("sc", "false");
      formData.append("sc", "false");
    }

    if (!isPartitioned) {
      params.append("pc", "false");
      formData.append("pc", "false");
    }

    if (method === "POST") {
      options.headers = {
        "Content-Type": "application/x-www-form-urlencoded",
      };
      options.body = formData;
    } else if (method === "GET") {
      if ([...params].length > 0) {
        url += "?" + params.toString();
      }
    }

    fetch(url, options)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch data from ${url}, status: ${response.status}`,
          );
        }
        return response.text();
      })
      .then((htmlContent) => {
        const elements = document.querySelectorAll(`.${className}`);
        elements.forEach((element) => {
          element.innerHTML = htmlContent;
        });
      })
      .catch((error) => {
        console.error(`Error updating elements: ${error.message}`);
      });
  },
}));

Alpine.plugin(Interval);
Alpine.start();
