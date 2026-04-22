# Simple JSP Student Login CRUD App

This project is a very simple JSP + Servlet + JDBC student web application.

It includes:

- student registration
- student login
- add student
- view student list
- update student
- delete student
- logout

## Database

Create the MySQL database and table using [database.sql](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/resources/database.sql:1).

Default connection values are in [DBConnection.java](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/java/com/example/util/DBConnection.java:1):

```java
jdbc:mysql://localhost:3306/student_app
username: root
password: root
```

If your MySQL username or password is different, change it there.

## Pages

- [login.jsp](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/webapp/login.jsp:1) for login
- [register.jsp](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/webapp/register.jsp:1) for creating a student account
- [home.jsp](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/webapp/home.jsp:1) for student CRUD operations

## Main Java files

- [LoginServlet.java](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/java/com/example/servlet/LoginServlet.java:1)
- [LogoutServlet.java](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/java/com/example/servlet/LogoutServlet.java:1)
- [StudentServlet.java](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/java/com/example/servlet/StudentServlet.java:1)
- [StudentDAO.java](/c:/Users/LOGAVANI%20V/OneDrive/Desktop/new/src/main/java/com/example/dao/StudentDAO.java:1)

## Run

1. Install MySQL.
2. Run the SQL script.
3. Install Apache Tomcat and Maven.
4. Build the WAR file with Maven.
5. Deploy the WAR in Tomcat.
6. Open `http://localhost:8080/jsp-student-crud/`

## Note

This project keeps passwords in plain text because you asked for a very simple beginner version.

For real projects, use password hashing and proper validation.
