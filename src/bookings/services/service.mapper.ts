import { ServiceResponse } from '@ascencio/shared/interfaces';
import { Service } from './entities';

export class ServiceMapper {
  static toResponse(entity: Service): ServiceResponse {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      isActive: entity.isActive,
      isAvailableOnline: entity.isAvailableOnline,
      address: entity.address,
      durationMinutes: entity.durationMinutes,
      imageUrl: entity.imageUrl,
      deletedAt: entity.deletedAt,
    };
  }
}
