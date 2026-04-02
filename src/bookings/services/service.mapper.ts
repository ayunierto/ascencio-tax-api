import { Service } from './entities';

export const toServiceResponse = (entity: Service): Service => {
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
    staffMembers: entity.staffMembers,
    appointments: entity.appointments,
  };
};
