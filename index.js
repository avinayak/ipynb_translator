const puppeteer = require("puppeteer");
var jsonFormat = require("json-format");
const _cliProgress = require("cli-progress");
var fs = require("fs");
const bar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);

var ascii = /[^\u0000-\u007F]/;
var queue = [];
var sessions = 0;

translate = (text, onComplete) => {
	puppeteer.launch().then(function(browser) {
		browser.newPage().then(function(page) {
			page.goto(`https://translate.google.com/#auto/en/${encodeURI(text)}`).then(function() {
				page.$eval("#result_box", function(heading) {
					return heading.innerText;
				})
					.then(function(result) {
						onComplete(true, result);
						browser.close();
					})
					.catch(() => {
						onComplete(false, text);
						browser.close();
					});
			});
		});
	});
};

fs.readFile(process.argv[2], function(err, data) {
	var ipynb = JSON.parse(data);
	Object.keys(ipynb.cells).map(x => {
		p = ipynb.cells[x].source;
		Object.keys(p).map(y => {
			if (ascii.test(ipynb.cells[x].source[y])) {
				queue.push({ x, y });
				//ipynb.cells[x].source[y] = "test \n";
			}
		});
	});
	var total = queue.length;
	bar.start(total, 0);
	setInterval(() => {
		if (sessions < 3) {
			var s = queue.pop(0);
			if (s) {
				sessions += 1;
				translate(ipynb.cells[s.x].source[s.y], (success, res) => {
					if (success && res.length>0) {
						ipynb.cells[s.x].source[s.y] = res.replace(/^\s+|\s+$/g, "") + "\n";
						sessions -= 1;
						bar.update(total - queue.length);
					} else {
                        queue.unshift(s);
                        sessions -= 1;
						bar.update(total - queue.length);
					}
				});
			} else {
				fs.writeFile(
					process.argv[3],
					jsonFormat(ipynb, {
						type: "space",
						size: 2
					}),
					function(err) {
						if (err) throw err;
						console.log("Saved!");
						bar.stop();
						process.exit();
					}
				);
			}
		}
	}, 2000);
});
