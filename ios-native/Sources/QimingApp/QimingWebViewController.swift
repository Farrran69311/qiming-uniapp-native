import UIKit
import WebKit
import os

final class QimingWebViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private let defaultEntry = "/welcome/index"
    private let schemeHandler = QimingSchemeHandler()
    private let logger = Logger(subsystem: "cn.intelledu.qiming.native", category: "WebView")
    private let diagnosticsFileURL: URL = {
        let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        return cachesDirectory.appendingPathComponent("qiming-native-diagnostics.jsonl", isDirectory: false)
    }()
    private var webView: WKWebView!
    private var lastRequestedEntry = "/welcome/index"
    private var lastRequestedRole = "teacher"
    private var launchTestScript = ""
    private var probeGeneration = 0

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .darkContent
    }

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(self, name: "qimingNative")
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.diagnosticsScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
        )
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: "qiming-app")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.988, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = true
        webView.customUserAgent = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)",
            "AppleWebKit/605.1.15 (KHTML, like Gecko)",
            "Mobile/15E148 Html5Plus QimingNative iOS"
        ].joined(separator: " ")
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.988, alpha: 1)
        let options = LaunchOptions(arguments: ProcessInfo.processInfo.arguments)
        lastRequestedRole = options.demoRole
        lastRequestedEntry = resolvedEntry(options.entry, role: options.demoRole)
        launchTestScript = options.testScript
        resetDiagnosticsFile()
        logNative("launch role=\(lastRequestedRole) entry=\(lastRequestedEntry)")
        loadOfflineBundle(entry: lastRequestedEntry, role: lastRequestedRole)
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        injectNativeInsets()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        recordDiagnostic(type: "web-message", payload: message.body)
        logNative("web message \(compactJSONString(message.body))")
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        probeGeneration += 1
        let url = webView.url?.absoluteString ?? "(pending)"
        recordDiagnostic(type: "navigation-start", payload: ["url": url])
        logNative("start \(url)")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let url = webView.url?.absoluteString ?? "(unknown)"
        recordDiagnostic(type: "navigation-finish", payload: ["url": url])
        logNative("finish \(url)")
        injectNativeInsets()
        scheduleWebProbes(generation: probeGeneration)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        recordDiagnostic(type: "navigation-fail", payload: ["error": error.localizedDescription])
        showLoadFailure(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        recordDiagnostic(type: "navigation-provisional-fail", payload: ["error": error.localizedDescription])
        showLoadFailure(error)
    }

    private func loadOfflineBundle(entry: String, role: String) {
        guard Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "AppResources"
        ) != nil else {
            showLoadFailure(QimingNativeError.missingOfflineBundle)
            return
        }

        let targetURL = indexUrlWithFragment(entry: entry, role: role)
        recordDiagnostic(type: "load-offline-bundle", payload: ["url": targetURL.absoluteString])
        logNative("load \(targetURL.absoluteString)")
        webView.load(URLRequest(url: targetURL))
    }

    private func indexUrlWithFragment(entry: String, role: String) -> URL {
        var fragment = resolvedEntry(entry, role: role)
        fragment = appendQuery(to: fragment, name: "demoRole", value: role)
        fragment = appendQuery(to: fragment, name: "qimingNative", value: "1")
        fragment = appendQuery(to: fragment, name: "nativeStatusTop", value: String(nativeSafeAreaInsets().top))

        let target = "qiming-app://localhost/index.html#\(fragment)"
        return URL(string: target) ?? URL(string: "qiming-app://localhost/index.html")!
    }

    private func resolvedEntry(_ entry: String, role: String) -> String {
        var output = entry.trimmingCharacters(in: .whitespacesAndNewlines)
        if output.isEmpty {
            output = defaultEntry
        }
        if output.hasPrefix("#") {
            output.removeFirst()
        }
        if !output.hasPrefix("/") {
            output = "/" + output
        }
        if output.hasPrefix("//") || output.contains("://") {
            output = defaultEntry
        }

        let path = output.split(separator: "?", maxSplits: 1).first.map(String.init) ?? output
        if role == "student", path == "/home" || path == "/welcome/index" {
            return "/account?menu=home"
        }
        if (role == "teacher" || role == "admin"),
           path == "/home" || output == "/account?menu=home" || output == "/account" {
            return defaultEntry
        }
        if (role == "teacher" || role == "admin"), path == "/account/ai-app" {
            return "/ai-app/workspace"
        }
        return output
    }

    private func appendQuery(to route: String, name: String, value: String) -> String {
        let separator = route.contains("?") ? "&" : "?"
        let encodedValue = value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
        return "\(route)\(separator)\(name)=\(encodedValue)"
    }

    private func injectNativeInsets() {
        guard isViewLoaded else { return }
        let insets = nativeSafeAreaInsets()
        let top = insets.top
        let bottom = insets.bottom
        let script = """
        (function () {
          document.documentElement.classList.add('qiming-native-webview', 'qiming-native-ios');
          document.documentElement.setAttribute('data-qiming-native', 'true');
          document.documentElement.style.setProperty('--qiming-native-safe-top', '\(top)px');
          document.documentElement.style.setProperty('--qiming-native-status-top', '\(top)px');
          document.documentElement.style.setProperty('--qiming-native-safe-bottom', '\(bottom)px');
          document.documentElement.style.setProperty('--pure-safe-area-top', '\(top)px');
          document.documentElement.style.setProperty('--pure-safe-area-bottom', '\(bottom)px');
          document.documentElement.style.setProperty('--pure-mobile-tab-height', 'calc(62px + \(bottom)px)');
          document.documentElement.style.setProperty('--pure-mobile-content-bottom-gap', 'calc(62px + \(bottom)px + 72px)');
          document.documentElement.style.setProperty('--qiming-native-bottom-clearance', 'calc(96px + \(bottom)px)');
        })();
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func nativeSafeAreaInsets() -> (top: Int, bottom: Int) {
        let windowInsets = view.window?.safeAreaInsets ?? .zero
        let statusBarHeight = view.window?.windowScene?.statusBarManager?.statusBarFrame.height ?? 0
        let top = max(view.safeAreaInsets.top, windowInsets.top, statusBarHeight)
        let bottom = max(view.safeAreaInsets.bottom, windowInsets.bottom)
        return (Int(top.rounded(.up)), Int(bottom.rounded(.up)))
    }

    private func scheduleWebProbes(generation: Int) {
        let delays: [Double] = [1.5, 4, 8, 15]
        for delay in delays {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self, generation == self.probeGeneration else { return }
                self.collectWebProbe(label: "\(Int(delay * 1000))ms")
            }
        }
        scheduleLaunchTestScript(generation: generation)
    }

    private func scheduleLaunchTestScript(generation: Int) {
        let script = launchTestScript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !script.isEmpty else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
            guard let self, generation == self.probeGeneration else { return }
            self.runLaunchTestScript(script)
        }
    }

    private func runLaunchTestScript(_ script: String) {
        let wrappedScript = """
        (function () {
          function postResult(result) {
            window.webkit.messageHandlers.qimingNative.postMessage({
              source: 'qiming-native-diagnostics',
              type: 'test-script',
              href: location.href,
              timestamp: Date.now(),
              result: result
            });
          }
          function postError(error) {
            window.webkit.messageHandlers.qimingNative.postMessage({
              source: 'qiming-native-diagnostics',
              type: 'test-script-error',
              href: location.href,
              timestamp: Date.now(),
              error: error && (error.stack || error.message || String(error))
            });
          }
          try {
            Promise.resolve((async function () {
              \(script)
            })()).then(postResult, postError);
          } catch (error) {
            postError(error);
          }
        })();
        """
        webView.evaluateJavaScript(wrappedScript) { [weak self] result, error in
            guard let self else { return }
            if let error {
                self.recordDiagnostic(type: "test-script-error", payload: [
                    "error": error.localizedDescription
                ])
                self.logNative("test script failed \(error.localizedDescription)")
                return
            }
            self.logNative("test script scheduled \(self.compactJSONString(result as Any))")
        }
    }

    private func collectWebProbe(label: String) {
        let script = """
        (function () {
          function textOf(selector) {
            var node = document.querySelector(selector);
            if (!node) return '';
            return (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 1800);
          }
          function boxOf(selector) {
            var node = document.querySelector(selector);
            if (!node) return null;
            var rect = node.getBoundingClientRect();
            var style = window.getComputedStyle(node);
            return {
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              top: Math.round(rect.top),
              left: Math.round(rect.left)
            };
          }
          var app = document.querySelector('#app');
          var loader = document.querySelector('.loader');
          var rootStyle = window.getComputedStyle(document.documentElement);
          return JSON.stringify({
            label: '\(label)',
            href: location.href,
            hash: location.hash,
            title: document.title,
            readyState: document.readyState,
            online: navigator.onLine,
            htmlClass: document.documentElement.className,
            bodyClass: document.body ? document.body.className : '',
            appBox: boxOf('#app'),
            loaderBox: boxOf('.loader'),
            navBox: boxOf('.nav-mobile-container'),
            mainBox: boxOf('.main-container'),
            mainContentBox: boxOf('.main-content'),
            cssVars: {
              safeTop: rootStyle.getPropertyValue('--pure-safe-area-top').trim(),
              safeBottom: rootStyle.getPropertyValue('--pure-safe-area-bottom').trim(),
              mobileTabHeight: rootStyle.getPropertyValue('--pure-mobile-tab-height').trim(),
              mobileContentBottomGap: rootStyle.getPropertyValue('--pure-mobile-content-bottom-gap').trim()
            },
            loaderVisible: !!loader && window.getComputedStyle(loader).display !== 'none',
            appText: textOf('#app'),
            localStorageKeys: Object.keys(localStorage).slice(0, 80),
            demoRole: localStorage.getItem('qiming-demo-role') || sessionStorage.getItem('qiming-demo-role') || '',
            nativeFlag: localStorage.getItem('qimingNativeWebView') || sessionStorage.getItem('qimingNativeWebView') || '',
            userInfo: (localStorage.getItem('user-info') || '').slice(0, 1200),
            routeCache: sessionStorage.getItem('qimingNativeLastRoute') || '',
            events: (window.__qimingNativeEvents || []).slice(-50)
          });
        })();
        """
        webView.evaluateJavaScript(script) { [weak self] result, error in
            guard let self else { return }
            if let error {
                self.recordDiagnostic(type: "web-probe-error", payload: [
                    "label": label,
                    "error": error.localizedDescription
                ])
                self.logNative("probe \(label) failed \(error.localizedDescription)")
                return
            }
            let payload = result as? String ?? self.compactJSONString(result as Any)
            self.recordDiagnostic(type: "web-probe", payload: payload)
            self.logNative("probe \(label) \(payload)")
        }
    }

    private func resetDiagnosticsFile() {
        try? FileManager.default.removeItem(at: diagnosticsFileURL)
        FileManager.default.createFile(atPath: diagnosticsFileURL.path, contents: nil)
    }

    private func recordDiagnostic(type: String, payload: Any) {
        let event: [String: Any] = [
            "type": type,
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "role": lastRequestedRole,
            "entry": lastRequestedEntry,
            "payload": jsonCompatibleValue(payload)
        ]
        guard JSONSerialization.isValidJSONObject(event),
              let data = try? JSONSerialization.data(withJSONObject: event, options: []),
              let newline = "\n".data(using: .utf8) else {
            return
        }
        if !FileManager.default.fileExists(atPath: diagnosticsFileURL.path) {
            FileManager.default.createFile(atPath: diagnosticsFileURL.path, contents: nil)
        }
        guard let handle = try? FileHandle(forWritingTo: diagnosticsFileURL) else { return }
        defer { try? handle.close() }
        _ = try? handle.seekToEnd()
        try? handle.write(contentsOf: data)
        try? handle.write(contentsOf: newline)
    }

    private func logNative(_ message: String) {
        NSLog("[QimingNative] %@", message)
        logger.info("[QimingNative] \(message, privacy: .public)")
    }

    private func compactJSONString(_ value: Any) -> String {
        let compatible = jsonCompatibleValue(value)
        if JSONSerialization.isValidJSONObject(compatible),
           let data = try? JSONSerialization.data(withJSONObject: compatible, options: []),
           let text = String(data: data, encoding: .utf8) {
            return text
        }
        return String(describing: value)
    }

    private func jsonCompatibleValue(_ value: Any) -> Any {
        if value is NSNull || value is String || value is NSNumber {
            return value
        }
        if let dictionary = value as? [String: Any] {
            return dictionary.reduce(into: [String: Any]()) { output, item in
                output[item.key] = jsonCompatibleValue(item.value)
            }
        }
        if let dictionary = value as? NSDictionary {
            var output: [String: Any] = [:]
            for (key, itemValue) in dictionary {
                output[String(describing: key)] = jsonCompatibleValue(itemValue)
            }
            return output
        }
        if let array = value as? [Any] {
            return array.map(jsonCompatibleValue)
        }
        if let array = value as? NSArray {
            return array.map(jsonCompatibleValue)
        }
        return String(describing: value)
    }

    private func showLoadFailure(_ error: Error) {
        let label = UILabel()
        label.numberOfLines = 0
        label.textAlignment = .center
        label.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        label.textColor = UIColor(red: 0.18, green: 0.22, blue: 0.31, alpha: 1)
        label.text = "IntellEdu failed to load.\n\n\(error.localizedDescription)"
        label.translatesAutoresizingMaskIntoConstraints = false

        let container = UIView()
        container.backgroundColor = UIColor(red: 0.969, green: 0.973, blue: 0.988, alpha: 1)
        container.addSubview(label)
        view = container
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 28),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -28),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor)
        ])
    }
}

private extension QimingWebViewController {
    static let diagnosticsScript = """
    (function () {
      if (window.__qimingNativeDiagnostics) return;
      window.__qimingNativeDiagnostics = true;
      function stringify(value) {
        try {
          var text;
          if (value instanceof Error) text = value.stack || value.message || String(value);
          else if (typeof value === 'object') text = JSON.stringify(value);
          else text = String(value);
          return text.length > 1800 ? text.slice(0, 1800) + '...<truncated>' : text;
        } catch (_) {
          return String(value);
        }
      }
      function post(type, payload) {
        try {
          var event = Object.assign({
            source: 'qiming-native-diagnostics',
            type: type,
            href: location.href,
            timestamp: Date.now()
          }, payload || {});
          window.__qimingNativeEvents = window.__qimingNativeEvents || [];
          window.__qimingNativeEvents.push(event);
          if (window.__qimingNativeEvents.length > 120) window.__qimingNativeEvents.shift();
          window.webkit.messageHandlers.qimingNative.postMessage(event);
        } catch (_) {}
      }
      post('diagnostics-installed');
      window.addEventListener('DOMContentLoaded', function () {
        post('dom-content-loaded', { readyState: document.readyState });
      });
      window.addEventListener('load', function () {
        post('window-load', { readyState: document.readyState, title: document.title });
      });
      window.addEventListener('hashchange', function () {
        post('hashchange', { hash: location.hash });
      });
      var originalError = console.error;
      console.error = function () {
        post('console.error', { args: Array.prototype.map.call(arguments, stringify) });
        return originalError.apply(console, arguments);
      };
      var originalWarn = console.warn;
      console.warn = function () {
        post('console.warn', { args: Array.prototype.map.call(arguments, stringify) });
        return originalWarn.apply(console, arguments);
      };
      var originalLog = console.log;
      console.log = function () {
        var args = Array.prototype.map.call(arguments, stringify);
        if (/\\[(Router|DemoSession|Qiming|Native)/i.test(args.join(' '))) {
          post('console.log', { args: args });
        }
        return originalLog.apply(console, arguments);
      };
      if (window.fetch) {
        var originalFetch = window.fetch;
        window.fetch = function () {
          var input = arguments[0];
          var init = arguments[1] || {};
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          var method = init.method || (input && input.method) || 'GET';
          return originalFetch.apply(this, arguments).then(function (response) {
            if (!response.ok || /edu\\/v1\\/user|get-async-routes|\\/api/i.test(url)) {
              post('fetch', {
                method: method,
                url: String(url).slice(0, 500),
                ok: response.ok,
                status: response.status,
                responseURL: response.url
              });
            }
            return response;
          }, function (error) {
            post('fetch-error', {
              method: method,
              url: String(url).slice(0, 500),
              error: stringify(error)
            });
            throw error;
          });
        };
      }
      if (window.XMLHttpRequest) {
        var OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function () {
          var xhr = new OriginalXHR();
          var method = 'GET';
          var url = '';
          var startTime = 0;
          var originalOpen = xhr.open;
          var originalSend = xhr.send;
          xhr.open = function () {
            method = arguments[0] || method;
            url = arguments[1] || url;
            return originalOpen.apply(xhr, arguments);
          };
          xhr.send = function () {
            startTime = Date.now();
            xhr.addEventListener('loadend', function () {
              var shouldLog = xhr.status >= 400 || /edu\\/|get-async-routes|\\/api/i.test(String(url));
              if (!shouldLog) return;
              post('xhr', {
                method: method,
                url: String(url).slice(0, 500),
                status: xhr.status,
                ok: xhr.status >= 200 && xhr.status < 300,
                responseURL: xhr.responseURL || '',
                durationMs: Date.now() - startTime
              });
            });
            xhr.addEventListener('error', function () {
              post('xhr-error', {
                method: method,
                url: String(url).slice(0, 500),
                status: xhr.status,
                responseURL: xhr.responseURL || '',
                durationMs: Date.now() - startTime
              });
            });
            return originalSend.apply(xhr, arguments);
          };
          return xhr;
        };
        window.XMLHttpRequest.prototype = OriginalXHR.prototype;
      }
      window.addEventListener('error', function (event) {
        var target = event.target;
        if (target && target !== window) {
          post('resource-error', {
            tagName: target.tagName,
            src: target.currentSrc || target.src || target.href || ''
          });
          return;
        }
        post('error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      }, true);
      window.addEventListener('unhandledrejection', function (event) {
        post('unhandledrejection', { reason: stringify(event.reason) });
      });
    })();
    """
}

private final class QimingSchemeHandler: NSObject, WKURLSchemeHandler {
    private let resourceDirectory: URL

    override init() {
        resourceDirectory = Bundle.main.resourceURL?
            .appendingPathComponent("AppResources", isDirectory: true)
            ?? URL(fileURLWithPath: "/")
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestUrl = urlSchemeTask.request.url else {
            fail(urlSchemeTask, code: NSURLErrorBadURL)
            return
        }

        let relativePath = normalizedRelativePath(from: requestUrl)
        guard let fileUrl = fileUrl(for: relativePath) else {
            NSLog("[QimingNativeScheme] missing resource %@ from %@", relativePath, requestUrl.absoluteString)
            fail(urlSchemeTask, code: NSURLErrorFileDoesNotExist)
            return
        }

        do {
            let data = try Data(contentsOf: fileUrl)
            let response = URLResponse(
                url: requestUrl,
                mimeType: mimeType(for: fileUrl.pathExtension),
                expectedContentLength: data.count,
                textEncodingName: textEncodingName(for: fileUrl.pathExtension)
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            NSLog("[QimingNativeScheme] resource error %@ %@", relativePath, error.localizedDescription)
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func normalizedRelativePath(from url: URL) -> String {
        let decodedPath = url.path.removingPercentEncoding ?? url.path
        let trimmed = decodedPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if trimmed.isEmpty {
            return "index.html"
        }
        return trimmed
    }

    private func fileUrl(for relativePath: String) -> URL? {
        guard !relativePath.contains("..") else { return nil }
        let candidate = resourceDirectory
            .appendingPathComponent(relativePath, isDirectory: false)
            .standardizedFileURL
        let rootPath = resourceDirectory.standardizedFileURL.path
        guard candidate.path == rootPath || candidate.path.hasPrefix(rootPath + "/") else {
            return nil
        }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDirectory) else {
            return nil
        }
        if isDirectory.boolValue {
            return candidate.appendingPathComponent("index.html", isDirectory: false)
        }
        return candidate
    }

    private func fail(_ task: WKURLSchemeTask, code: Int) {
        task.didFailWithError(NSError(domain: NSURLErrorDomain, code: code))
    }

    private func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json", "webmanifest", "map": return "application/json"
        case "wasm": return "application/wasm"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "webp": return "image/webp"
        case "ico": return "image/x-icon"
        case "mp4": return "video/mp4"
        case "webm": return "video/webm"
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }

    private func textEncodingName(for ext: String) -> String? {
        switch ext.lowercased() {
        case "html", "htm", "js", "mjs", "css", "json", "webmanifest", "svg", "txt":
            return "utf-8"
        default:
            return nil
        }
    }
}

private struct LaunchOptions {
    let entry: String
    let demoRole: String
    let testScript: String

    init(arguments: [String]) {
        var entry = ProcessInfo.processInfo.environment["QIMING_ENTRY"] ?? "/welcome/index"
        var role = ProcessInfo.processInfo.environment["QIMING_DEMO_ROLE"] ?? "teacher"
        var testScript = ProcessInfo.processInfo.environment["QIMING_TEST_SCRIPT"] ?? ""

        var index = 0
        while index < arguments.count {
            let current = arguments[index]
            let next = index + 1 < arguments.count ? arguments[index + 1] : nil
            if (current == "--entry" || current == "-entry"), let next {
                entry = next
                index += 2
                continue
            }
            if (current == "--demoRole" || current == "--role"), let next {
                role = next
                index += 2
                continue
            }
            if (current == "--testScript" || current == "--test-script"), let next {
                testScript = next
                index += 2
                continue
            }
            index += 1
        }

        self.entry = entry
        self.demoRole = ["student", "teacher", "admin"].contains(role) ? role : "teacher"
        self.testScript = testScript
    }
}

private enum QimingNativeError: LocalizedError {
    case missingOfflineBundle

    var errorDescription: String? {
        switch self {
        case .missingOfflineBundle:
            return "Offline bundle was not found. Run pnpm native:prepare first."
        }
    }
}
