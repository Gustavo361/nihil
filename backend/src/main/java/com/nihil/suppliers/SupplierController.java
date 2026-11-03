package com.nihil.suppliers;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {
  private final SupplierRepository repository;
  SupplierController(SupplierRepository repository) { this.repository = repository; }

  @GetMapping
  List<SupplierResponse> list() { return repository.findAll().stream().map(SupplierResponse::from).toList(); }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  SupplierResponse create(@Valid @RequestBody SupplierRequest request) {
    var now = OffsetDateTime.now();
    var supplier = new Supplier();
    supplier.id = UUID.randomUUID(); supplier.name = request.name().trim(); supplier.documentNumber = blankToNull(request.documentNumber());
    supplier.contactName = blankToNull(request.contactName()); supplier.phone = blankToNull(request.phone());
    supplier.email = blankToNull(request.email()); supplier.notes = blankToNull(request.notes()); supplier.active = true;
    supplier.createdAt = now; supplier.updatedAt = now;
    return SupplierResponse.from(repository.save(supplier));
  }
  private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
  public record SupplierRequest(@NotBlank String name, String documentNumber, String contactName, String phone, String email, String notes) {}
  public record SupplierResponse(UUID id, String name, String documentNumber, String contactName, String phone, String email, boolean active, String notes) {
    static SupplierResponse from(Supplier s) { return new SupplierResponse(s.id, s.name, s.documentNumber, s.contactName, s.phone, s.email, s.active, s.notes); }
  }
}
