// This grabs the current date based on the users date and time
var today = new Date();

// This is when I was born
var birthdate = new Date("1998-03-27");

// This calculates the difference in milliseconds
var difference_ms = today.getTime() - birthdate.getTime();

// This will convert the difference to years
var age = Math.floor(difference_ms / (1000 * 60 * 60 * 24 * 365));

// And this will display my current age wherever I put it
document.getElementById("age").innerHTML = age;