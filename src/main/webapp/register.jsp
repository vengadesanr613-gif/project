<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<!DOCTYPE html>
<html>
<head>
    <title>Register Student</title>
</head>
<body>
<h2>Register Student</h2>

<form action="students" method="post">
    <input type="hidden" name="action" value="create" />
    <input type="hidden" name="publicCreate" value="1" />
    <input type="text" name="name" placeholder="Name" required /><br><br>
    <input type="email" name="email" placeholder="Email" required /><br><br>
    <input type="text" name="username" placeholder="Username" required /><br><br>
    <input type="password" name="password" placeholder="Password" required /><br><br>
    <button type="submit">Submit</button>
</form>

<br>
<a href="login.jsp">Back</a>
</body>
</html>
