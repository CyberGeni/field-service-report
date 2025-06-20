export const getServiceTypeTargets = (serviceType: string) => {
  switch (serviceType) {
    case 'auxiliary_pioneer':
      return { 
        monthlyTarget: 30, 
        yearlyTarget: 360,
        label: 'Auxiliary Pioneer'
      };
    case 'regular_pioneer':
      return { 
        monthlyTarget: 50, 
        yearlyTarget: 600,
        label: 'Regular Pioneer'
      };
    default:
      return { 
        monthlyTarget: 10, 
        yearlyTarget: 120,
        label: 'Publisher'
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
  return `${targets.monthlyTarget} hours monthly, ${targets.yearlyTarget} hours yearly`;
};