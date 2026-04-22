<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="java.util.List,com.example.model.Student" %>
<%
    if (session.getAttribute("username") == null) {
        response.sendRedirect("login.jsp");
        return;
    }

    List<Student> students = (List<Student>) request.getAttribute("students");
    Student editStudent = (Student) request.getAttribute("editStudent");
%>
<!DOCTYPE html>
<html>
<head>
    <title>Home</title>
</head>
<body>
<h2>Welcome <%= session.getAttribute("username") %></h2>

<form action="logout" method="post">
    <button type="submit">Logout</button>
</form>

<h3><%= editStudent == null ? "Add Student" : "Edit Student" %></h3>
<form action="students" method="post">
    <input type="hidden" name="action" value="<%= editStudent == null ? "create" : "update" %>">
    <input type="hidden" name="id" value="<%= editStudent != null ? editStudent.getId() : "" %>">

    <input type="text" name="name" placeholder="Name" value="<%= editStudent != null ? editStudent.getName() : "" %>" required><br><br>
    <input type="email" name="email" placeholder="Email" value="<%= editStudent != null ? editStudent.getEmail() : "" %>" required><br><br>
    <input type="text" name="username" placeholder="Username" value="<%= editStudent != null ? editStudent.getUsername() : "" %>" required><br><br>
    <input type="text" name="password" placeholder="Password" value="<%= editStudent != null ? editStudent.getPassword() : "" %>" required><br><br>

    <button type="submit">Submit</button>
</form>

<h3>Student List</h3>
<table border="1" cellpadding="10">
    <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Email</th>
        <th>Username</th>
        <th>Password</th>
        <th>Action</th>
    </tr>
    <% if (students != null) {
        for (Student student : students) { %>
    <tr>
        <td><%= student.getId() %></td>
        <td><%= student.getName() %></td>
        <td><%= student.getEmail() %></td>
        <td><%= student.getUsername() %></td>
        <td><%= student.getPassword() %></td>
        <td>
            <a href="students?editId=<%= student.getId() %>">Edit</a>

            <form action="students" method="post" style="display:inline;">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<%= student.getId() %>">
                <button type="submit">Delete</button>
            </form>
        </td>
    </tr>
    <% }} %>
</table>
</body>
</html>
