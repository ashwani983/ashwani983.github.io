---
title: "SELENIUM Cheat Sheet"
date: 2023-08-13
slug: selenium-cheat-sheet
tags: [Automation, cheatsheet, java, Selenium, Testing]
category: Tester
excerpt: "Creating Driver: Action Selenium code Description Firefox driver WebDriver Driver = new FirefoxDriver (); Driver is an object IE driver System.setProperty(“webd"
readTime: 4 min read
published: true
---

![SELENIUM Cheat Sheet](https://upload.wikimedia.org/wikipedia/commons/4/47/SeBlackRed.jpg)

## **Creating Driver:**

**Action**

**Selenium code**

**Description**

Firefox driver

_WebDriver Driver = new FirefoxDriver ();_

Driver is an object

IE driver

_System.setProperty(“webdriver.ie. driver”, PATH); WebDriver driver = **new** InternetExplorerDriver ();_

PATH = path of IEDriver exe file;

chrome Driver

_System.setProperty(“webdriver.ie. driver”,PATH); WebDriver driver = **new** ChromeDriver ();_

PATH = path of chrome exe file;

## **Identify Elements:**

**Action**

**Code**

**Description**

Find single Element

_driver.findElement(locator)_

Locator is a location of element

Find multiple Elements

_driver.findElements(locator)_

Locator is a location of element

## **Locating UI Elements:**

**Action**

**Code**

**Description**

By ID

_driver. findElement (By.id(str));_

_Str_ is id of element

By Name

_driver.findElement(By.name(str));_

_Str_ is name of element

By class name

_driver. findElement (By. className(str));_

_Str_ is class value of element

By CSS selector

_driver.findElement(By.cssSelector(str));_

_Str_ is cssSelector of element

By link text

_driver.findElement(By.linkText(str));_

_Str_ is link text of element

By partial link text

_driver.findElement(By.partialLinkText(str));_

_Str_ is partial text of element

By tag name

_driver.findElement(By.tagName(str));_

_Str_ is tag name of element

By XPath

_driver.findElement(By.xpath(xpath));_

_Str_ is xpath of element

## **Handling JavaScript Alerts:**

To handle alert first, we need to switch to alert.

_Alert al=driver.switchTo().alert();_ The Actions list.

**Action**

**code**

Click on ok in alert

_al.accept();_

Click on cancel.

_al.dismiss()_

Type in alert box.

_al.sendKeys(“text”);_

Get text from alert box.

_al.getText();_

## **Capture Screen Shot of Browser:**

**Action**

**Code**

**Description**

Capture screen

_File scrFile1 = ((TakesScreenshot)driver).getScreenshotAs(OutputType.FIL E);_

It captures a screenshot of a particular page and stores it in variable

Save to disk

_FileUtils.copyFile(scrFile1, **new** File(“c:\\\\tmp\\\\k2.png”));_

Save screenshot as k2.png

**User Actions:**

**Action**

**Code**

**Description**

Write in text fields

_driver.findElement(locator).sendKeys(text);_

Text: what u want to write locator is a location element

Click button or click radio button or check box

_driver. findElement(locator). click();_

locator is a location element

Clear text in text field

_driver. findElement(locator). clear();_

locator is a location element

Navigate back and forward in browser

_driver.navigate(). back(); driver.navigate().forward();_

 

Navigate to frame

_driver. switchTo().frame(frame);_

frame can be integer value represents position of frame or string represents id of frame or WebElement represents frame of frame.

Navigate to next window or pop up window

_driver.switchTo().window(hashCode);_

hashCode is hash code of window

Get inner text of element or inner text of table

_driver.findElement(locator).getText();_

locator is a location element

Working on auto complete/suggestions Or Calendar pop up

_driver. findElement(locator). click();_

Get the locator of hidden division or element and perform required operation.

## **Select drop down list:**

Using Select class, we can work on select drop down. Create select object for specific select drop down.

//creating webelement for select dropdown WebElement _usrs=driver.findElement(By.name(“users”)); Select usr=new Select(usrs);_

We can select options of drop down in 3 different ways as explained below:

**Action**

**code**

**description**

Select by using id of option tag

_usr.selectById(ID);_

_ID_ is a string, value of _ID_ attribute of option.

Select by using index of option tag

_usr.selectByIndex(i);_

_I_ is the position of option

Select by using visible text in option tag

_usr.selectByVisibleText(str)_

_str_ is the text inside the option tag.

## **Working on Excel sheet:**

Before working on Excel, first we need to read excel in input stream using file IO stream. _FileInputStream fis=new FileInputStream(“Path of .xlsx file”);_

**Action**

**Code**

**Description**

Convert file io into workbook

_Workbook wb = WorkbookFactory.create(fis);_

Create function creates work book.

Get into specified sheet

_Sheet s = wb.getSheet(sheetName); Or Sheet s = wb.getSheetAt(sheetNum);_

sheetName is name of the sheet sheetNum is index of sheet

Get into specified row

_Row r = s.getRow(rowNum);_

 

Get into specified column

_Cell c = r.getCell(colNum);_

 

Get cell value

_String cellVal = c.getStringCellValue(); Or boolean b = c.getBooleanCellValue(); or Date d = c.getDateCellValue(); Or int I = c.getNumericCellValue();_

Get cell value based on value in excel cell

Get row count

_int I = s.getLastRowNum();_

 

Get Column count

_int j = r. getLastCellNum ();_

 

Write back to excel

_c.setCellValue(“PASS1”); FileOutputStream fos = **new** FileOutputStream(“Path of .xlsx file “); wb.write(fos); fos.close();_

 

# Drag, Drop and Mouse Over, Mouse Events:

We use Actions Class for drag and drop Create an object to action class Actions a=new Actions(driver);

**Action**

**code**

**description**

Drag and Drop using source and destination

_a.dragAndDrop(src, des).build().perform();_

Src and dest is the Web Element object of source and destination of drag and drop element.

Drag and drop to specific position

a.dragAndDrop(src, x,y).build().perform();

x and y are integer values for a specific position.

Mouse over on specific element.

_a.moveToElement(element).build().perform();_

An element is an object of WebElement which points to required element.

Mouse right click

_a.contextClick(element).build().perform();_

Element is an object of WebElement which points to a required element.

Mouse movement after right click

_a.sendKeys(Keys.<keyboardstrokes>).build().perform();_

Keys is a class contains all keystrokes such as right left, enter, back button.

\_\_ATA = window.\_\_ATA || {}; \_\_ATA.cmd = window.\_\_ATA.cmd || \[\]; \_\_ATA.cmd.push(function() { \_\_ATA.initVideoSlot('atatags-370373-6a71b3cb1bc3c', { sectionId: '370373', format: 'inread' }); });

Like Loading...

### _Related_
