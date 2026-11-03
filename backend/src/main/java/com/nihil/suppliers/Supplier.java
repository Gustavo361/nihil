package com.nihil.suppliers;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "supplier")
class Supplier {
  @Id UUID id;
  @Column(nullable = false) String name;
  String documentNumber;
  String contactName;
  String phone;
  String email;
  @Column(nullable = false) boolean active;
  String notes;
  @Column(nullable = false) OffsetDateTime createdAt;
  @Column(nullable = false) OffsetDateTime updatedAt;
}
