export const getServiceTypeTargets = (serviceType: string) => {
  switch (serviceType) {
    case 'auxiliary_pioneer':
      return { 
        monthlyTarget: 30, 
        yearlyTarget: 360,
        label: 'Auxiliary Pioneer',
        hasRequirement: true
      };
    case 'regular_pioneer':
      return { 
        monthlyTarget: 50, 
        yearlyTarget: 600,
        label: 'Regular Pioneer',
        hasRequirement: true
      };
    case 'publisher':
    default:
      return { 
        monthlyTarget: 10, // Default suggestion
        yearlyTarget: 120, // Default suggestion
        label: 'Publisher',
        hasRequirement: false
      };
  }
};

export const getServiceTypeLabel = (serviceType: string) => {
  switch (serviceType) {
    case 'auxiliary_pioneer':
      return 'Auxiliary Pioneer';
    case 'regular_pioneer':
      return 'Regular Pioneer';
    default:
      return 'Publisher';
  }
};

export const getServiceTypeDescription = (serviceType: string) => {
  const targets = getServiceTypeTargets(serviceType);
  
  if (targets.hasRequirement) {
    return `${targets.monthlyTarget} hours monthly, ${targets.yearlyTarget} hours yearly`;
  } else {
    return 'Set your own personal goals';
  }
};

export const hasHourRequirement = (serviceType: string): boolean => {
  return serviceType === 'auxiliary_pioneer' || serviceType === 'regular_pioneer';
};