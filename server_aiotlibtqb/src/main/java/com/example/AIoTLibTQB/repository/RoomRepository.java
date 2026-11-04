package com.example.AIoTLibTQB.repository;

import com.example.AIoTLibTQB.document.Room;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends MongoRepository<Room, String> {

    Optional<Room> findByCode(String code);

    boolean existsByCode(String code);

    List<Room> findByFloor(Integer floor);
}
