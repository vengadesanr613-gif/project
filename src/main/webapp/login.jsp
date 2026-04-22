<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<!DOCTYPE html>
<html>
<head>
    <title>Student Login</title>
</head>
<body>
<h2>Student Login</h2>

<%
    String error = request.getParameter("error");
    if ("1".equals(error)) {
%>
<p>Invalid username or password</p>
<%
    }
    String registered = request.getParameter("registered");
    if ("1".equals(registered)) {
%>
<p>Registration successful. Please login.</p>
<%
    }
%>

<form action="login" method="post">
    <input type="text" name="username" placeholder="Username" required /><br><br>
    <input type="password" name="password" placeholder="Password" required /><br><br>
    <button type="submit">Submit</button>
</form>

<br>
<a href="register.jsp">Register</a>
</body>
</html>
