---
title: "Python Time Module"
date: 2021-08-12
slug: python-time-module
tags: [datetime, Python, time, time.sleep()]
category: Developer
excerpt: "Python has the module named time to deal with time associated tasks. In this article, we are able to discover the time module in detail. We will discover ways t"
readTime: 3 min read
published: true
---

Python has the module named **time** **to deal with** time-**associated** tasks. In this article, **we are able to** **discover** the time module in detail. We will **discover ways to** use the **one-of-a-kind** time-**associated** **capabilities** **described** **withinside the** time module. The Python time module **affords** many **approaches** of representing time **withinside the** code, **which includes** objects, numbers, and strings. It **additionally** **affords** **capability** **apart from** representing time, like **ready** **all through** the code execution and measuring the **performance** of the code.

![Python time module output](assets/images/blog/python-time-module-1.png)

python time image 1.1

If we want to use functions defined in the [module](https://appdividend.com/2019/02/05/python-modules-tutorial-example-how-to-create-modules-in-python/), we need to import the module first.

```
from time import time
```

You can manage the concept of Python time in your application is by using the floating-point number that represents a number of seconds that have passed since the beginning of an era that is, since the particular starting point. Let’s go to that Epoch point.

## **Python time.time()**

Let’s calculate the total seconds since the **epoch**.

```
# app.py 
from time import time 
seconds = time.time() 
print("Seconds since epoch =", seconds)
```

It returns a **floating point value** that represents the number of seconds that have passed since the **epoch**. The epoch is a a **platform-dependent** point where the time starts.

If you’re unsure what is the epoch on the system you’re using, use the `gmtime()` function. It takes one argument (a number of seconds) and converts the time to a struct. If you define the number as zero, it will simply display the **beginning of the epoch**:

```
print(time.gmtime(0))
```

## **Converting Python time**

The `gmtime()` function returns the struct time in Coordinated Universal Time (UTC). If you need it in **local time**, use `localtime()`. To get an opposite result, use `mktime()`:

```
t = time.localtime(seconds)
print("The struct_time is:", t)

sec = time.mktime(t)
print("The number of seconds is:", sec)
```

If you need the Python time represented in a **string**, use `asctime()` (if you have a struct time) or `cttime()` (if you have a floating point value). Both of these functions will return a Python timestamp:

```
t = (2020, 1, 13, 13, 18, 9, 0, 3, 0)
date = time.asctime(t)

seconds = time.time()
date2 = time.ctime(seconds)
```

## **Using the Python time.sleep() function**

The **`time`** module also allows you to time the execution of your threads. To delay a certain process, use the Python `time.sleep()` function:

```
print("Hello.")
time.sleep(3)
print("It's been three seconds since we said hello.")
```

You only need to define one argument, which is a floating-point number. It represents the **number of seconds** to delay the action for.

Using the Python `time.sleep()` function with a while loop, you can also create a basic **digital clock**:

```
while True:
  localtime = time.localtime()
  result = time.strftime("%I:%M:%S", localtime)
  print(result)
  time.sleep(1)
```

## **Python time: useful tips**

1.  There are two more Python modules that help you deal with time and date: `calendar` handles the calendar-related functions, and `datetime` lets you manipulate Python timestamps. You can also extend `datetime` withe the `dateutil` package from PyPI.
2.  If you’re working with **multithreaded programs**, remember that the Python `time.sleep()` function only delays a single **thread** and not the whole process.

\_\_ATA = window.\_\_ATA || {}; \_\_ATA.cmd = window.\_\_ATA.cmd || \[\]; \_\_ATA.cmd.push(function() { \_\_ATA.initVideoSlot('atatags-370373-6a71b3c549ec2', { sectionId: '370373', format: 'inread' }); });

Like Loading...

### _Related_
