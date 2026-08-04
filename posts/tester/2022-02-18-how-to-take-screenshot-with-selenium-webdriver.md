---
title: "How to take Screenshot with Selenium WebDriver?"
date: 2022-02-18
slug: how-to-take-screenshot-with-selenium-webdriver
tags: [Automation, c#, java, javascript, Python, ruby, screenshot, webdriver]
category: Tester
excerpt: "Selenium WebDriver Capture Screenshot Whenever we encounter a failure during testing, it is a common nature to capture the screenshots wherever there is a devia"
readTime: 2 min read
published: true
---

![](https://atlcodify.wordpress.com/wp-content/uploads/2022/02/screenshot.png?w=750)

Selenium WebDriver Capture Screenshot

Whenever we encounter a failure during testing, it is a common nature to capture the screenshots wherever there is a deviation from the expected result. Thus it is considered a mandatory step to attach a screenshot for creating a bug.

While automating a bunch of test cases of a considerable number, capturing screenshot is critical to infer why a test case has failed for both the development and testing team. As they debug the failures, going through the screenshot and conclude if the failure is due to script issue or defect in the application.

Let us discuss which part of the page may be captured as a screenshot. With the help of Selenium WebDriver we will try to take screenshot in different Language.

![](https://atlcodify.wordpress.com/wp-content/uploads/2022/02/python_logo_icon.png?w=150)

Python

```
from selenium import webdriver

browser = webdriver.Firefox()
browser.get('http://www.google.com/')
browser.save_screenshot('screenie.png')
```

Confusingly, a `_.get_screenshot_as_file(filename)_` method also exists that does the same thing.

There are also methods for: `_.get_screenshot_as_base64()_` (for embedding in HTML) and `_.get_screenshot_as_png()_`(for retrieving binary data).

And _note_ that WebElements have a `_.screenshot()_` method that works similarly, but only captures the selected element.

Python  `_.get_screenshot_as_file(filename)_` method:

```
from selenium import webdriver

driver=webdriver.Chrome(r'C:\Utility\BrowserDrivers\chromedriver.exe')
driver.get("http://google.com")
driver.get_screenshot_as_file('./Screenshots/get_screenshot_as_file_method.png')
driver.quit()
```

![](https://atlcodify.wordpress.com/wp-content/uploads/2022/02/java.png?w=1024)

Java

```
WebDriver driver = new FirefoxDriver();
driver.get("http://www.google.com/");
File scrFile =((TakesScreenshot)driver).getScreenshotAs(OutputType.FILE);
FileUtils.copyFile(scrFile, new File("c:\\tmp\\screenshot.png"));
```

![](https://atlcodify.wordpress.com/wp-content/uploads/2022/02/437px-c_sharp_logo.svg_.png?w=437)

C#

```
driver = new PhantomJSDriver();
driver.Manage().Window.Size = new System.Drawing.Size(1280, 1024);
driver.Navigate().GoToUrl("http://www.example.com/");
driver.GetScreenshot().SaveAsFile("screenshot.png",ImageFormat.Png);
driver.Quit();
```

![](https://atlcodify.wordpress.com/wp-content/uploads/2022/02/php-programming-language.png?w=1024)

PHP

```
class MyTestClass extends PHPUnit_Extensions_Selenium2TestCase {
    ...
    public function screenshot($filepath) {
        $filedata = $this->currentScreenshot();
        file_put_contents($filepath, $filedata);
    }

    public function testSomething() {
        $this->screenshot('/path/to/screenshot.png');
    }
    ...
}
```

![](https://atlcodify.wordpress.com/wp-content/uploads/2022/02/ruby.png?w=400)

Ruby

```
require 'rubygems'
require 'selenium-webdriver'

driver = Selenium::WebDriver.for :ie
driver.get "https://www.google.com"
driver.save_screenshot("./screen.png")
```

![](https://atlcodify.wordpress.com/wp-content/uploads/2022/02/js.png?w=1024)

Java Script

```
driver.takeScreenshot().then(function(data){
   var base64Data = data.replace(/^data:image\/png;base64,/,"")
   fs.writeFile("out.png", base64Data, 'base64', function(err) {
        if(err) console.log(err);
   });
});
```

\_\_ATA = window.\_\_ATA || {}; \_\_ATA.cmd = window.\_\_ATA.cmd || \[\]; \_\_ATA.cmd.push(function() { \_\_ATA.initVideoSlot('atatags-370373-6a71b3c62fb4e', { sectionId: '370373', format: 'inread' }); });

Like Loading...

### _Related_
