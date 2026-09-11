import { ShopSourcingService } from '@/services/ShopSourcingService';

ShopSourcingService.expireAndRebroadcast()
  .then((result) => {
    console.log('[shop-offer-rebroadcast]', result);
  })
  .catch((err) => {
    console.error('[shop-offer-rebroadcast]', err);
    process.exitCode = 1;
  });
