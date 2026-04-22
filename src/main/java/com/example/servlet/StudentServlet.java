package com.example.servlet;

import com.example.dao.StudentDAO;
import com.example.model.Student;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;

@WebServlet("/students")
public class StudentServlet extends HttpServlet {

    private final StudentDAO studentDAO = new StudentDAO();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        if (!isLoggedIn(request)) {
            response.sendRedirect("login.jsp");
            return;
        }

        String editId = request.getParameter("editId");
        if (editId != null && !editId.isBlank()) {
            request.setAttribute("editStudent", studentDAO.getStudentById(Integer.parseInt(editId)));
        }

        request.setAttribute("students", studentDAO.getAllStudents());
        request.getRequestDispatcher("home.jsp").forward(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String action = request.getParameter("action");
        boolean registerPage = "1".equals(request.getParameter("publicCreate"));

        if (!registerPage && !isLoggedIn(request)) {
            response.sendRedirect("login.jsp");
            return;
        }

        if ("create".equals(action)) {
            studentDAO.addStudent(buildStudent(request));

            if (registerPage) {
                response.sendRedirect("login.jsp?registered=1");
            } else {
                response.sendRedirect("students");
            }
            return;
        }

        if ("update".equals(action)) {
            Student student = buildStudent(request);
            student.setId(Integer.parseInt(request.getParameter("id")));
            studentDAO.updateStudent(student);
            response.sendRedirect("students");
            return;
        }

        if ("delete".equals(action)) {
            int id = Integer.parseInt(request.getParameter("id"));
            studentDAO.deleteStudent(id);
        }

        response.sendRedirect("students");
    }

    private boolean isLoggedIn(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session != null && session.getAttribute("username") != null;
    }

    private Student buildStudent(HttpServletRequest request) {
        return new Student(
                request.getParameter("name"),
                request.getParameter("email"),
                request.getParameter("username"),
                request.getParameter("password")
        );
    }
}
