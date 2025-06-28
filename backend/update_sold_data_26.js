const { MongoClient } = require('mongodb');

const atlasUri = "mongodb+srv://vphone:A3QxEWIocDlgjW30@vphone.zfafkjc.mongodb.net/test";
const vpsUri = "mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/vphone?authSource=admin";

async function updateSoldData() {
  const atlasClient = new MongoClient(atlasUri);
  const vpsClient = new MongoClient(vpsUri);
  
  try {
    await atlasClient.connect();
    await vpsClient.connect();
    
    const atlasDb = atlasClient.db('test');
    const vpsDb = vpsClient.db('vphone');
    
    const soldItems = await atlasDb.collection('inventories').find({
      sold_date: {
        $gte: new Date('2025-06-26T00:00:00.000Z'),
        $lt: new Date('2025-06-27T00:00:00.000Z')
      }
    }).toArray();
    
    console.log(`Tìm thấy ${soldItems.length} sản phẩm bán ngày 26 trên Atlas`);
    
    let updatedCount = 0;
    
    for (const item of soldItems) {
      const updateData = {
        status: 'sold',
        sold_date: item.sold_date,
        price_sell: item.price_sell,
        customer_name: item.customer_name || '',
        customer_phone: item.customer_phone || '',
        note: item.note || '',
        warranty: item.warranty || '',
        updatedAt: item.updatedAt
      };
      
      const result = await vpsDb.collection('inventories').updateOne(
        { _id: item._id },
        { $set: updateData }
      );
      
      if (result.modifiedCount > 0) {
        updatedCount++;
        console.log(`✅ Updated: ${item.product_name} - Customer: ${item.customer_name}`);
      }
    }
    
    console.log(`\n🎉 Hoàn thành! Đã cập nhật ${updatedCount}/${soldItems.length} sản phẩm`);
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await atlasClient.close();
    await vpsClient.close();
  }
}

updateSoldData();
