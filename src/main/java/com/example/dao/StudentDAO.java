package com.example.dao;

import com.example.model.Student;
import com.example.util.DBConnection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class StudentDAO {

    public boolean validateLogin(String username, String password) {
        String sql = "select id from students where username=? and password=?";

        try (Connection connection = DBConnection.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, username);
            statement.setString(2, password);

            ResultSet resultSet = statement.executeQuery();
            return resultSet.next();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public void addStudent(Student student) {
        String sql = "insert into students(name, email, username, password) values (?, ?, ?, ?)";

        try (Connection connection = DBConnection.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, student.getName());
            statement.setString(2, student.getEmail());
            statement.setString(3, student.getUsername());
            statement.setString(4, student.getPassword());
            statement.executeUpdate();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public List<Student> getAllStudents() {
        List<Student> students = new ArrayList<>();
        String sql = "select * from students order by id";

        try (Connection connection = DBConnection.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                Student student = new Student(
                        resultSet.getString("name"),
                        resultSet.getString("email"),
                        resultSet.getString("username"),
                        resultSet.getString("password")
                );
                student.setId(resultSet.getInt("id"));
                students.add(student);
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        return students;
    }

    public Student getStudentById(int id) {
        String sql = "select * from students where id=?";

        try (Connection connection = DBConnection.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);

            ResultSet resultSet = statement.executeQuery();
            if (resultSet.next()) {
                Student student = new Student(
                        resultSet.getString("name"),
                        resultSet.getString("email"),
                        resultSet.getString("username"),
                        resultSet.getString("password")
                );
                student.setId(resultSet.getInt("id"));
                return student;
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        return null;
    }

    public void updateStudent(Student student) {
        String sql = "update students set name=?, email=?, username=?, password=? where id=?";

        try (Connection connection = DBConnection.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, student.getName());
            statement.setString(2, student.getEmail());
            statement.setString(3, student.getUsername());
            statement.setString(4, student.getPassword());
            statement.setInt(5, student.getId());
            statement.executeUpdate();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public void deleteStudent(int id) {
        String sql = "delete from students where id=?";

        try (Connection connection = DBConnection.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            statement.executeUpdate();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
